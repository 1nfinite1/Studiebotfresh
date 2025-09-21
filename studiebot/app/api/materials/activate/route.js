export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../infra/db/mongoClient';

function ok(data = {}, status = 200, headers) {
  const base = { ok: true, policy: { guardrail_triggered: false, reason: 'none' } };
  return NextResponse.json({ ...base, ...data }, { status, headers });
}

function err(status, message, where = 'materials/activate', extra = {}, headers) {
  const base = { ok: false, error: message, where, policy: { guardrail_triggered: false, reason: 'none' } };
  return NextResponse.json({ ...base, ...extra }, { status, headers });
}

async function handleActivate(req) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return err(400, 'Kon JSON niet lezen.', 'materials/activate', { db_ok: false }, new Headers({ 'X-Debug': 'materials:activate|bad_json' }));
    }

    const material_id = String(body.material_id || body.setId || '').trim();
    if (!material_id) {
      return err(400, 'material_id of setId is verplicht.', 'materials/activate', { db_ok: false }, new Headers({ 'X-Debug': 'materials:activate|missing_id' }));
    }

    const db = await getDatabase();
    const materials = db.collection('materials');

    const doc = await materials.findOne({
      $or: [ { material_id }, { id: material_id }, { setId: material_id } ],
    });
    if (!doc) {
      return err(404, 'Materiaal niet gevonden.', 'materials/activate', { material_id, db_ok: true }, new Headers({ 'X-Debug': 'materials:activate|not_found' }));
    }

    const segCount = Number(doc.segments || 0);
    if (!Number.isFinite(segCount) || segCount < 1) {
      return NextResponse.json(
        { ok: false, db_ok: true, reason: 'no_segments', message: 'Geen segmenten gevonden voor dit materiaal.', material_id },
        { status: 200, headers: new Headers({ 'X-Debug': 'materials:activate|no_segments' }) }
      );
    }

    await materials.updateOne({ _id: doc._id }, { $set: { status: 'active', active: true, updated_at: new Date().toISOString() } });

    return ok({ db_ok: true, activated: true, material_id }, 200, new Headers({ 'X-Debug': 'materials:activate|ok' }));
  } catch (e) {
    return err(500, 'Onverwachte serverfout bij activeren.', 'materials/activate', { db_ok: false }, new Headers({ 'X-Debug': 'materials:activate|server_error' }));
  }
}

export async function PUT(req) { return handleActivate(req); }
export async function POST(req) { return handleActivate(req); }