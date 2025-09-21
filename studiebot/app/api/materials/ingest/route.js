export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../infra/db/mongoClient';
import { GridFSBucket, ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

// OCR feature flags
const OCR_ENABLED = process.env.OCR_ENABLED === 'true';
const OCR_PROVIDER = process.env.OCR_PROVIDER || 'ocrspace';
const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY || '';

function ok(data = {}, status = 200, headers) {
  const base = { ok: true, policy: { guardrail_triggered: false, reason: 'none' } };
  return NextResponse.json({ ...base, ...data }, { status, headers });
}

function err(status, message, where = 'materials/ingest', extra = {}, headers) {
  const base = { ok: false, error: message, where, policy: { guardrail_triggered: false, reason: 'none' } };
  return NextResponse.json({ ...base, ...extra }, { status, headers });
}

async function readBufferFromGridFS(db, bucketName, fileIdStr) {
  try {
    const bucket = new GridFSBucket(db, { bucketName });
    let oid = null;
    try { oid = new ObjectId(fileIdStr); } catch { oid = null; }
    if (!oid) return null;
    const stream = bucket.openDownloadStream(oid);
    const chunks = [];
    return await new Promise((resolve) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => { try { resolve(Buffer.concat(chunks)); } catch { resolve(null); } });
      stream.on('error', () => resolve(null));
    });
  } catch {
    return null;
  }
}

async function extractTextFromBuffer(mime, buffer) {
  try {
    if (mime === 'application/pdf') {
      const res = await pdf(buffer);
      return String(res?.text || '');
    }
    if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const res = await mammoth.extractRawText({ buffer });
      return String(res?.value || '');
    }
  } catch (_) { /* ignore */ }
  return '';
}

async function ocrWithOCRSpace(buffer, mime, filename) {
  if (!OCR_SPACE_API_KEY) return { text: '', used: false };
  try {
    const fd = new FormData();
    const blob = new Blob([buffer], { type: mime || 'application/pdf' });
    fd.append('file', blob, filename || 'document.pdf');
    fd.append('language', 'dut');
    fd.append('isOverlayRequired', 'false');
    fd.append('scale', 'true');
    fd.append('OCREngine', '2');
    const r = await fetch('https://api.ocr.space/parse/image', { method: 'POST', headers: { 'apikey': OCR_SPACE_API_KEY }, body: fd });
    const j = await r.json().catch(() => ({}));
    const parsed = Array.isArray(j?.ParsedResults) && j.ParsedResults[0]?.ParsedText ? j.ParsedResults[0].ParsedText : '';
    return { text: String(parsed || ''), used: Boolean(parsed) };
  } catch (_) { return { text: '', used: false }; }
}

function sanitizeText(text) { return String(text || '').replace(/\r/g, ' ').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim(); }
function chunkText(text, maxLen = 1800) { const chunks = []; let i = 0; while (i < text.length) { const end = Math.min(i + maxLen, text.length); chunks.push(text.slice(i, end)); i = end; } return chunks; }

export async function POST(req) {
  try {
    let body = {}; try { body = await req.json(); } catch { return err(400, 'Kon JSON niet lezen.', 'materials/ingest', { db_ok: false }, new Headers({ 'X-Debug': 'materials:ingest|bad_json' })); }

    const material_id = String(body.material_id || body.setId || '').trim();
    if (!material_id) { return err(400, 'material_id of setId is verplicht.', 'materials/ingest', { db_ok: false }, new Headers({ 'X-Debug': 'materials:ingest|missing_id' })); }

    const db = await getDatabase();
    const materials = db.collection('materials');
    const segmentsCol = db.collection('material_segments');

    const doc = await materials.findOne({ $or: [ { material_id }, { id: material_id }, { setId: material_id } ] });
    if (!doc) { return err(404, 'Materiaal niet gevonden.', 'materials/ingest', { material_id, db_ok: true }, new Headers({ 'X-Debug': 'materials:ingest|not_found' })); }

    const fileIdStr = doc?.storage?.file_id || null;
    const bucketName = doc?.storage?.bucket || 'uploads';
    const buf = fileIdStr ? await readBufferFromGridFS(db, bucketName, fileIdStr) : null;

    let extracted = await extractTextFromBuffer(doc.mime || doc.type, buf || Buffer.alloc(0));
    let ocrUsed = false;
    if ((!extracted || extracted.trim().length < 10) && OCR_ENABLED && OCR_PROVIDER === 'ocrspace' && (doc.mime === 'application/pdf' || doc.type === 'pdf')) {
      const ocr = await ocrWithOCRSpace(buf || Buffer.alloc(0), doc.mime || 'application/pdf', doc.filename || 'document.pdf');
      if (ocr.used && ocr.text) { extracted = ocr.text; ocrUsed = true; }
    }
    extracted = sanitizeText(extracted);

    if (!extracted) {
      await materials.updateOne({ _id: doc._id }, { $set: { segments: Math.max(1, Number(doc.segments || 0)), updated_at: new Date().toISOString() } });
      const headers = new Headers({ 'X-Debug': 'materials:ingest|no_content' });
      if (ocrUsed) headers.set('X-OCR', 'ocrspace');
      return ok({ db_ok: true, material_id, segments: Number(doc.segments || 1), note: 'no_content' }, 200, headers);
    }

    const chunks = chunkText(extracted, 1800).slice(0, 60);
    const nowIso = new Date().toISOString();
    const docs = chunks.map((t) => ({ segment_id: `seg_${randomUUID()}`, material_id, text: t, tokens: Math.max(10, Math.round(t.length / 4)), created_at: nowIso }));
    if (docs.length) await segmentsCol.insertMany(docs);

    const count = await segmentsCol.countDocuments({ material_id });
    await materials.updateOne({ _id: doc._id }, { $set: { segments: count, updated_at: nowIso } });

    const headers = new Headers({ 'X-Debug': 'materials:ingest|created_segments' });
    if (ocrUsed) headers.set('X-OCR', 'ocrspace');
    return ok({ db_ok: true, material_id, segments: count }, 200, headers);
  } catch (e) {
    return err(500, 'Onverwachte serverfout bij ingest.', 'materials/ingest', { db_ok: false }, new Headers({ 'X-Debug': 'materials:ingest|server_error' }));
  }
}