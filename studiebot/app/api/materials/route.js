export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { fetchMaterials, getMaterialsStats } from '../../../infra/db/materialsService';
import { getDatabase } from '../../../infra/db/mongoClient';

function ok(data = {}, status = 200) {
  const base = { ok: true, policy: { guardrail_triggered: false, reason: 'none' } };
  return NextResponse.json({ ...base, ...data }, { status });
}

function err(status, message, where = 'materials/list', extra = {}) {
  const base = { ok: false, error: message, where, policy: { guardrail_triggered: false, reason: 'none' } };
  return NextResponse.json({ ...base, ...extra }, { status });
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const wantStats = searchParams.get('stats') === '1' || searchParams.get('stats') === 'true';

    // Quick DB health check
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
        return ok({ db_ok, stats });
      } catch (e) {
        return err(500, 'Kon statistieken niet ophalen.', 'materials/stats', { db_ok });
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
      items = await fetchMaterials({ subject, grade, chapter, topic });
    } catch {
      // fetchMaterials already logs; keep items as []
    }

    return ok({ db_ok, items });
  } catch (e) {
    return err(500, 'Onverwachte serverfout bij materials.', 'materials/list', { db_ok: false });
  }
}