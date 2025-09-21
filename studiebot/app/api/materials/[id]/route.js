export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { deleteMaterialCascade } from '../../../../infra/db/materialsService';

function ok(data = {}, status = 200, headers) { return NextResponse.json({ ok: true, ...data }, { status, headers }); }
function err(status, reason, message = undefined, extra = {}, headers) { const base = { ok: false, reason }; if (message) base.message = message; return NextResponse.json({ ...base, ...extra }, { status, headers }); }

export async function DELETE(_req, { params }) {
  try {
    const id = params?.id ? String(params.id) : '';
    if (!id) return err(400, 'missing_id', 'id is required', {}, new Headers({ 'X-Debug': 'materials:delete_path|missing_id' }));
    const result = await deleteMaterialCascade(id);
    if (result.materials === 0) return err(404, 'not_found', 'Material not found', {}, new Headers({ 'X-Debug': 'materials:delete_path|not_found' }));
    return ok({ deleted: result }, 200, new Headers({ 'X-Debug': 'materials:delete_path|ok' }));
  } catch {
    return err(500, 'server_error', 'Unexpected server error', {}, new Headers({ 'X-Debug': 'materials:delete_path|server_error' }));
  }
}