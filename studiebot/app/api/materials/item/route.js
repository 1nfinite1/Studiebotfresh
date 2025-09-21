export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { deleteMaterialCascade } from '../../../../infra/db/materialsService';

function ok(data = {}, status = 200, headers) { return NextResponse.json({ ok: true, ...data }, { status, headers }); }
function err(status, reason, message = undefined, extra = {}, headers) { const base = { ok: false, reason }; if (message) base.message = message; return NextResponse.json({ ...base, ...extra }, { status, headers }); }

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = String(searchParams.get('id') || '').trim();
    if (!id) return err(400, 'bad_request', 'id is required', {}, new Headers({ 'X-Debug': 'materials:item_delete|missing_id' }));
    const result = await deleteMaterialCascade(id);
    if ((result?.materials || 0) === 0) return err(404, 'not_found', 'Material not found', {}, new Headers({ 'X-Debug': 'materials:item_delete|not_found' }));
    return ok({ deleted: result }, 200, new Headers({ 'X-Debug': 'materials:item_delete|ok' }));
  } catch {
    return err(500, 'server_error', 'Unexpected server error', {}, new Headers({ 'X-Debug': 'materials:item_delete|server_error' }));
  }
}

export async function POST(req) {
  try {
    let body = {};
    try { body = await req.json(); } catch { return err(400, 'bad_request', 'Invalid JSON body', {}, new Headers({ 'X-Debug': 'materials:item_delete|bad_json' })); }
    const id = String(body.material_id || body.id || '').trim();
    if (!id) return err(400, 'missing_id', 'material_id is required', {}, new Headers({ 'X-Debug': 'materials:item_delete|missing_id' }));
    const result = await deleteMaterialCascade(id);
    if ((result?.materials || 0) === 0) return err(404, 'not_found', 'Material not found', {}, new Headers({ 'X-Debug': 'materials:item_delete|not_found' }));
    return ok({ deleted: result }, 200, new Headers({ 'X-Debug': 'materials:item_delete|ok' }));
  } catch {
    return err(500, 'server_error', 'Unexpected server error', {}, new Headers({ 'X-Debug': 'materials:item_delete|server_error' }));
  }
}