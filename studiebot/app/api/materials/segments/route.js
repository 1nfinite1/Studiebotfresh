export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../infra/db/mongoClient';

function ok(data = {}, status = 200, headers) {
  const base = { ok: true, policy: { guardrail_triggered: false, reason: 'none' } };
  return NextResponse.json({ ...base, ...data }, { status, headers });
}

function err(status, message, where = 'materials/segments', extra = {}, headers) {
  const base = { ok: false, error: message, where, policy: { guardrail_triggered: false, reason: 'none' } };
  return NextResponse.json({ ...base, ...extra }, { status, headers });
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const material_id = (searchParams.get('material_id') || searchParams.get('id') || '').trim();
    if (!material_id) {
      return err(400, 'material_id is verplicht.', 'materials/segments', {}, new Headers({ 'X-Debug': 'materials:segments|missing_id' }));
    }
    const db = await getDatabase();
    const materials = db.collection('materials');
    const segmentsCol = db.collection('material_segments');

    const doc = await materials.findOne({ $or: [{ material_id }, { id: material_id }, { setId: material_id }] });
    if (!doc) {
      return err(404, 'Materiaal niet gevonden.', 'materials/segments', { material_id }, new Headers({ 'X-Debug': 'materials:segments|not_found' }));
    }
    const count = await segmentsCol.countDocuments({ material_id: doc.material_id });
    if (count !== (doc.segments || 0)) {
      await materials.updateOne({ _id: doc._id }, { $set: { segments: count } });
    }
    return ok({ material_id: doc.material_id, segments: count, segmentsCount: count, pagesCount: count }, 200, new Headers({ 'X-Debug': 'materials:segments|ok' }));
  } catch (e) {
    return err(500, 'Onverwachte serverfout bij segments.', 'materials/segments', {}, new Headers({ 'X-Debug': 'materials:segments|server_error' }));
  }
}