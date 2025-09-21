export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDatabase } from '../../../infra/db/mongoClient';

function ok(data = {}, status = 200, headers) {
  const base = { ok: true, policy: { guardrail_triggered: false, reason: 'none' } };
  const h = new Headers(headers || {});
  h.set('Cache-Control', 'no-store');
  return NextResponse.json({ ...base, ...data }, { status, headers: h });
}

function err(status, message, where = 'materials/list', extra = {}, headers) {
  const base = { ok: false, error: message, where, policy: { guardrail_triggered: false, reason: 'none' } };
  const h = new Headers(headers || {});
  h.set('Cache-Control', 'no-store');
  return NextResponse.json({ ...base, ...extra }, { status, headers: h });
}

const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function toUiItem(item) {
  const material_id = item.material_id || item.id || item.materialId || item._id || null;
  const id = material_id;
  const setId = material_id;
  const filename = item.filename || item.file?.filename || 'bestand.pdf';
  const mime = item.mime || item.file?.mime || item.file?.type || null;
  const type = item.type || (mime === PDF ? 'pdf' : mime === DOCX ? 'docx' : 'unknown');
  const size = item.size ?? item.file?.size ?? null;
  const status = item.status || (item.active ? 'active' : 'ready');
  const createdAt = item.createdAt || item.created_at || null;
  const uploader = item.uploader || 'docent';
  const segments = typeof item.segments === 'number' ? item.segments : 0;
  const active = !!item.active || status === 'active';
  return {
    id,
    setId,
    filename,
    type,
    size,
    status,
    createdAt,
    uploader,
    segments,
    active,
    material_id,
    storage: item.storage || null,
    subject: item.subject ?? null,
    topic: item.topic ?? null,
    grade: item.grade ?? null,
    chapter: item.chapter ?? null,
  };
}

async function ensureSegments(db, item) {
  try {
    const materials = db.collection('materials');
    const segmentsCol = db.collection('material_segments');
    const material_id = item.material_id || item.id || item.setId;
    if (!material_id) return item;

    const seg = Number(item.segments || 0);
    if (Number.isFinite(seg) && seg >= 1) return item;

    const existing = await segmentsCol.countDocuments({ material_id });
    if (existing >= 1) {
      await materials.updateOne({ material_id }, { $set: { segments: existing } });
      return { ...item, segments: existing };
    }
    const preview = item.filename ? `Stub from filename: ${item.filename}` : 'Placeholder segment';
    await segmentsCol.insertOne({
      segment_id: `seg_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
      material_id,
      text: preview,
      tokens: Math.max(10, Math.round(preview.length / 4)),
      created_at: new Date().toISOString(),
    });
    await materials.updateOne({ material_id }, { $set: { segments: 1 } });
    return { ...item, segments: 1 };
  } catch {
    return item;
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const subject = searchParams.get('subject') || undefined;
    const topic = searchParams.get('topic') || undefined;
    const gradeRaw = searchParams.get('grade');
    const chapterRaw = searchParams.get('chapter');
    const grade = gradeRaw != null ? Number(gradeRaw) : undefined;
    const chapter = chapterRaw != null ? Number(chapterRaw) : undefined;

    let db_ok = true;
    let items = [];
    try {
      const db = await getDatabase();
      await db.command({ ping: 1 });
      const materials = db.collection('materials');

      const selector = {};
      if (subject) selector.$and = (selector.$and || []).concat([{ $or: [ { subject }, { subject: null }, { subject: { $exists: false } } ] }]);
      if (typeof grade === 'number') selector.$and = (selector.$and || []).concat([{ $or: [ { grade }, { grade: null }, { grade: { $exists: false } } ] }]);
      if (typeof chapter === 'number') selector.$and = (selector.$and || []).concat([{ $or: [ { chapter }, { chapter: null }, { chapter: { $exists: false } } ] }]);
      if (topic) selector.$and = (selector.$and || []).concat([{ $or: [ { topic }, { topic: null }, { topic: { $exists: false } } ] }]);

      const raw = await materials.find(selector.$and ? selector : {}, { projection: { _id: 0 } }).sort({ created_at: -1 }).limit(200).toArray();
      const normalized = Array.isArray(raw) ? raw.map(toUiItem) : [];

      const ensured = [];
      for (const it of normalized) {
        ensured.push(await ensureSegments(db, it));
      }
      items = ensured;
    } catch {
      db_ok = false;
      items = [];
    }

    return ok({ db_ok, items }, 200, new Headers({ 'X-Debug': 'materials:list_final' }));
  } catch (e) {
    return err(500, 'Onverwachte serverfout bij materials.', 'materials/list', { db_ok: false }, new Headers({ 'X-Debug': 'materials:server_error' }));
  }
}