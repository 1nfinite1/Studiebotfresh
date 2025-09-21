export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { previewMaterial } from '../../../../../infra/db/materialsService';

function ok(data = {}, status = 200, headers) { return NextResponse.json({ ok: true, ...data }, { status, headers }); }
function err(status, reason, message = undefined, extra = {}, headers) { const base = { ok: false, reason }; if (message) base.message = message; return NextResponse.json({ ...base, ...extra }, { status, headers }); }

export async function GET(_req, { params }) {
  try {
    const id = params?.id ? String(params.id) : '';
    if (!id) return err(400, 'missing_id', 'id is required', {}, new Headers({ 'X-Debug': 'materials:preview_path|missing_id' }));
    const pv = await previewMaterial(id);
    if (!pv) return err(404, 'not_found', 'Material not found', {}, new Headers({ 'X-Debug': 'materials:preview_path|not_found' }));
    return ok({ material: { id: pv.id, filename: pv.filename, type: pv.type, size: pv.size, pagesCount: pv.pagesCount }, preview: { textSnippet: pv.textSnippet, firstPage: pv.firstPage, chars: pv.chars } }, 200, new Headers({ 'X-Debug': 'materials:preview_path|ok' }));
  } catch {
    return err(500, 'server_error', 'Unexpected server error', {}, new Headers({ 'X-Debug': 'materials:preview_path|server_error' }));
  }
}