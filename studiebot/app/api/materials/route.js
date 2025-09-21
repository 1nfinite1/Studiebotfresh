export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { fetchMaterials, getMaterialsStats } from '../../../infra/db/materialsService';
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

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const wantStats = searchParams.get('stats') === '1' || searchParams.get('stats') === 'true';

    let db_ok = true;
    try {
      const db = await getDatabase();
      await db.command({ ping: 1 });
    } catch {
      db_ok = false;
    }

    if (wantStats) {
      try {
        const stats = await getMaterialsStats();
        return ok({ db_ok, stats }, 200, new Headers({ 'X-Debug': 'materials:stats' }));
      } catch (e) {
        return err(500, 'Kon statistieken niet ophalen.', 'materials/stats', { db_ok }, new Headers({ 'X-Debug': 'materials:stats_error' }));
      }
    }

    const subject = searchParams.get('subject') || undefined;
    const topic = searchParams.get('topic') || undefined;
    const gradeRaw = searchParams.get('grade');
    const chapterRaw = searchParams.get('chapter');
    const grade = gradeRaw != null ? Number(gradeRaw) : undefined;
    const chapter = chapterRaw != null ? Number(chapterRaw) : undefined;

    let items = [];
    try {
      const raw = await fetchMaterials({ subject, grade, chapter, topic });
      items = Array.isArray(raw) ? raw.map(toUiItem) : [];
    } catch {
      items = [];
    }

    return ok({ db_ok, items }, 200, new Headers({ 'X-Debug': 'materials:list_v4' }));
  } catch (e) {
    return err(500, 'Onverwachte serverfout bij materials.', 'materials/list', { db_ok: false }, new Headers({ 'X-Debug': 'materials:server_error' }));
  }
}