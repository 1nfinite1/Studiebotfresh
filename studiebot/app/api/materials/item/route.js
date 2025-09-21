export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { deleteMaterialCascade } from '../../../../infra/db/materialsService';

function ok(data = {}, status = 200, headers) { return NextResponse.json({ ok: true, ...data }, { status, headers }); }
function err(status, reason, message, extra = {}, headers) { return NextResponse.json({ ok: false, reason, message, ...extra }, { status, headers }); }

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const material_id = String(searchParams.get('id') || searchParams.get('material_id') || '').trim();
    if (!material_id) return err(400, 'missing_id', 'material_id is required', {}, new Headers({ 'X-Debug': 'materials:delete|missing_id' }));
    const result = await deleteMaterialCascade(material_id);
    if (!result || result.materials === 0) return err(404, 'not_found', 'Material not found', {}, new Headers({ 'X-Debug': 'materials:delete|not_found' }));
    return ok({ deleted: result }, 200, new Headers({ 'X-Debug': 'materials:delete|ok' }));
  } catch (e) {
    return err(500, 'server_error', 'Unexpected server error', {}, new Headers({ 'X-Debug': 'materials:delete|server_error' }));
  }
}