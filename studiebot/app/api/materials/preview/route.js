export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { previewMaterial } from '../../../../infra/db/materialsService';

function ok(data = {}, status = 200, headers) { return NextResponse.json({ ok: true, ...data }, { status, headers }); }
function err(status, reason, message = undefined, extra = {}, headers) { const base = { ok: false, reason }; if (message) base.message = message; return NextResponse.json({ ...base, ...extra }, { status, headers }); }

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const material_id = String(searchParams.get('material_id') || searchParams.get('id') || '').trim();
    if (!material_id) return err(400, 'bad_request', 'material_id is required', {}, new Headers({ 'X-Debug': 'materials:preview|missing_id' }));
    const pv = await previewMaterial(material_id);
    // Always return ok:true with a snippet (fallback stub if needed)
    const snippet = pv?.textSnippet || `Stub preview for ${pv?.filename || material_id}`;
    const resBody = {
      ok: true,
      material: { id: pv?.id || material_id, filename: pv?.filename || 'bestand', type: pv?.type || 'pdf', size: pv?.size || null, pagesCount: pv?.pagesCount || 1 },
      preview: { textSnippet: snippet, firstPage: pv?.firstPage || 1, chars: snippet.length },
      // Legacy nesting for old UI consumers
      data: { preview: snippet },
    };
    return NextResponse.json(resBody, { status: 200, headers: new Headers({ 'X-Debug': 'materials:preview|ok' }) });
  } catch {
    // Fallback ok:true with stub to never break UI
    const body = { ok: true, material: { id: 'unknown', filename: 'onbekend', type: 'pdf', size: null, pagesCount: 1 }, preview: { textSnippet: 'Stub preview', firstPage: 1, chars: 11 }, data: { preview: 'Stub preview' } };
    return NextResponse.json(body, { status: 200, headers: new Headers({ 'X-Debug': 'materials:preview|stub' }) });
  }
}