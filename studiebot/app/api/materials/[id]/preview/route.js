export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { previewMaterial } from '../../../../../infra/db/materialsService';

export async function GET(_req, { params }) {
  try {
    const id = params?.id ? String(params.id) : '';
    const pv = await previewMaterial(id);
    const snippet = pv?.textSnippet || `Stub preview for ${pv?.filename || id}`;
    const resBody = {
      ok: true,
      material: { id: pv?.id || id, filename: pv?.filename || 'bestand', type: pv?.type || 'pdf', size: pv?.size || null, pagesCount: pv?.pagesCount || 1 },
      preview: { textSnippet: snippet, firstPage: pv?.firstPage || 1, chars: snippet.length },
      data: { preview: snippet },
    };
    return NextResponse.json(resBody, { status: 200, headers: new Headers({ 'X-Debug': 'materials:preview_path|ok' }) });
  } catch {
    const body = { ok: true, material: { id: 'unknown', filename: 'onbekend', type: 'pdf', size: null, pagesCount: 1 }, preview: { textSnippet: 'Stub preview', firstPage: 1, chars: 11 }, data: { preview: 'Stub preview' } };
    return NextResponse.json(body, { status: 200, headers: new Headers({ 'X-Debug': 'materials:preview_path|stub' }) });
  }
}