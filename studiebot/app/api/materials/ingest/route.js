export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../infra/db/mongoClient';
import { GridFSBucket, ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

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
      stream.on('end', () => {
        try { resolve(Buffer.concat(chunks)); } catch { resolve(null); }
      });
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

function sanitizeText(text) {
  if (!text) return '';
  return String(text).replace(/\r/g, ' ').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
}

function chunkText(text, maxLen = 1800) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + maxLen, text.length);
    const slice = text.slice(i, end);
    chunks.push(slice);
    i = end;
  }
  return chunks;
}

export async function POST(req) {
  try {
    let body = {};
    try { body = await req.json(); } catch {
      return err(400, 'Kon JSON niet lezen.', 'materials/ingest', { db_ok: false }, new Headers({ 'X-Debug': 'materials:ingest|bad_json' }));
    }

    const material_id = String(body.material_id || body.setId || '').trim();
    if (!material_id) {
      return err(400, 'material_id of setId is verplicht.', 'materials/ingest', { db_ok: false }, new Headers({ 'X-Debug': 'materials:ingest|missing_id' }));
    }

    const db = await getDatabase();
    const materials = db.collection('materials');
    const segmentsCol = db.collection('material_segments');

    const doc = await materials.findOne({
      $or: [ { material_id }, { id: material_id }, { setId: material_id } ],
    });
    if (!doc) {
      return err(404, 'Materiaal niet gevonden.', 'materials/ingest', { material_id, db_ok: true }, new Headers({ 'X-Debug': 'materials:ingest|not_found' }));
    }

    const fileIdStr = doc?.storage?.file_id || null;
    const bucketName = doc?.storage?.bucket || 'uploads';
    const buf = fileIdStr ? await readBufferFromGridFS(db, bucketName, fileIdStr) : null;

    let extracted = await extractTextFromBuffer(doc.mime || doc.type, buf || Buffer.alloc(0));
    extracted = sanitizeText(extracted);

    if (!extracted) {
      // keep existing behavior but mark as no_content
      await materials.updateOne({ _id: doc._id }, { $set: { segments: Math.max(1, Number(doc.segments || 0)), updated_at: new Date().toISOString() } });
      return ok({ db_ok: true, material_id, segments: Number(doc.segments || 1), note: 'no_content' }, 200, new Headers({ 'X-Debug': 'materials:ingest|no_content' }));
    }

    const chunks = chunkText(extracted, 1800).slice(0, 60);
    const nowIso = new Date().toISOString();
    const docs = chunks.map((t) => ({
      segment_id: `seg_${randomUUID()}`,
      material_id,
      text: t,
      tokens: Math.max(10, Math.round(t.length / 4)),
      created_at: nowIso,
    }));

    if (docs.length) await segmentsCol.insertMany(docs);

    const count = await segmentsCol.countDocuments({ material_id });
    await materials.updateOne({ _id: doc._id }, { $set: { segments: count, updated_at: nowIso } });

    return ok({ db_ok: true, material_id, segments: count }, 200, new Headers({ 'X-Debug': 'materials:ingest|created_segments' }));
  } catch (e) {
    return err(500, 'Onverwachte serverfout bij ingest.', 'materials/ingest', { db_ok: false }, new Headers({ 'X-Debug': 'materials:ingest|server_error' }));
  }
}