export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { fetchMaterials } from '../../../../infra/db/materialsService';
import { getDatabase } from '../../../../infra/db/mongoClient';

function ok(data = {}, status = 200, headers) {
  const base = { ok: true, policy: { guardrail_triggered: false, reason: 'none' } };
  const h = new Headers(headers || {});
  h.set('Cache-Control', 'no-store');
  return NextResponse.json({ ...base, ...data }, { status, headers: h });
}

function err(status, message, where = 'materials/list_alias', extra = {}, headers) {
  const base = { ok: false, error: message, where, policy: { guardrail_triggered: false, reason: 'none' } };
  const h = new Headers(headers || {});
  h.set('Cache-Control', 'no-store');
  return NextResponse.json({ ...base, ...extra }, { status, headers: h });
}

function toUiItem(item) {
  const material_id = item.material_id || item.id || item.materialId || item._id || null;
  const id = material_id;
  const setId = material_id;
  const filename = item.filename || item.file?.filename || 'bestand.pdf';
  const mime = item.mime || item.file?.mime || item.file?.type || null;
  const type = item.type || (mime === 'application/pdf' ? 'pdf' : mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? 'docx' : 'unknown');
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

function parseNum(value) {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    // Map old → new: vak→subject, leerjaar→grade, hoofdstuk→chapter
    const subject = (searchParams.get('subject') || searchParams.get('vak') || '').trim() || undefined;
    const topic = (searchParams.get('topic') || '').trim() || undefined; // keep as-is if present
    const grade = parseNum(searchParams.get('grade') ?? searchParams.get('leerjaar'));
    const chapter = parseNum(searchParams.get('chapter') ?? searchParams.get('hoofdstuk'));

    // DB health
    let db_ok = true;
    try {
      const db = await getDatabase();
      await db.command({ ping: 1 });
    } catch {
      db_ok = false;
    }

    // Fetch and normalize
    let items = [];
    try {
      const raw = await fetchMaterials({ subject, grade, chapter, topic });
      items = Array.isArray(raw) ? raw.map(toUiItem) : [];
    } catch {
      items = [];
    }

    return ok({ db_ok, items }, 200, new Headers({ 'X-Debug': 'materials:list_alias_v2' }));
  } catch (e) {
    return err(500, 'Onverwachte serverfout bij materials alias.', 'materials/list_alias', { db_ok: false }, new Headers({ 'X-Debug': 'materials:list_alias_error' }));
  }
}