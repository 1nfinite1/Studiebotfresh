export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../infra/db/mongoClient';

const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const LEGACY = process.env.LEGACY_MATERIALS_API !== 'false';

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
function typeFromMime(m) { return m === PDF ? 'pdf' : m === DOCX ? 'docx' : 'unknown'; }
function toLegacy(item) {
  const material_id = item.material_id || item.id || item.materialId || item._id || null;
  const id = material_id;
  const setId = material_id;
  const filename = item.filename || item.file?.filename || 'bestand.pdf';
  const mime = item.mime || item.file?.mime || item.file?.type || null;
  const type = item.type || typeFromMime(mime);
  const size = item.size ?? item.file?.size ?? null;
  const active = !!item.active;
  const status = active ? 'active' : (item.status || 'ready');
  const createdAt = item.createdAt || item.created_at || new Date().toISOString();
  const uploader = item.uploader || 'docent';
  const segments = Math.max(1, Number(item.segments || 0));
  return {
    id, setId, filename, type, size, status, createdAt, uploader,
    segments, segmentsCount: segments, pagesCount: segments,
    ready: status !== 'active', active,
    material_id,
    storage: item.storage || null,
    subject: item.subject ?? null,
    topic: item.topic ?? null,
    grade: item.grade ?? null,
    chapter: item.chapter ?? null,
  };
}
function parseNum(v){ if(v==null) return undefined; const n=Number(v); return Number.isFinite(n)?n:undefined; }

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const subject = (searchParams.get('subject') || searchParams.get('vak') || '').trim() || undefined;
    const topic = (searchParams.get('topic') || '').trim() || undefined;
    const grade = parseNum(searchParams.get('grade') ?? searchParams.get('leerjaar'));
    const chapter = parseNum(searchParams.get('chapter') ?? searchParams.get('hoofdstuk'));

    let db_ok = true; let items = [];
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
      items = Array.isArray(raw) ? raw.map((x) => (LEGACY ? toLegacy(x) : x)) : [];
    } catch { db_ok = false; items = []; }

    const sets = items; const count = items.length;
    return ok({ db_ok, items, sets, count }, 200, new Headers({ 'X-Debug': 'materials:list_alias' }));
  } catch (e) {
    return err(500, 'Onverwachte serverfout bij materials alias.', 'materials/list_alias', { db_ok: false }, new Headers({ 'X-Debug': 'materials:list_alias_error' }));
  }
}