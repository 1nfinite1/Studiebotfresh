export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../infra/db/mongoClient';
import { GridFSBucket } from 'mongodb';
import { randomUUID } from 'crypto';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const BUCKET_NAME = process.env.GRIDFS_BUCKET || 'uploads';
const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const LEGACY = process.env.LEGACY_MATERIALS_API !== 'false';

// OCR feature flags
const OCR_ENABLED = process.env.OCR_ENABLED === 'true';
const OCR_PROVIDER = process.env.OCR_PROVIDER || 'ocrspace';
const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY || '';

function ok(data = {}, status = 200, headers) {
  const base = { ok: true, policy: { guardrail_triggered: false, reason: 'none' } };
  return NextResponse.json({ ...base, ...data }, { status, headers });
}

function err(status, message, where = 'materials/upload', extra = {}, headers) {
  const base = { ok: false, error: message, where, policy: { guardrail_triggered: false, reason: 'none' } };
  return NextResponse.json({ ...base, ...extra }, { status, headers });
}

function detectType(mime, filename) {
  if (mime === PDF) return 'pdf';
  if (mime === DOCX) return 'docx';
  if (filename && filename.toLowerCase().endsWith('.docx')) return 'docx';
  if (filename && filename.toLowerCase().endsWith('.pdf')) return 'pdf';
  return 'unknown';
}

function legacyField(value, fallback = 'Onbekend') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;
  return value;
}

function toLegacyMaterial(doc) {
  const segments = Math.max(1, Number(doc.segments || 0));
  const status = doc.active ? 'active' : (doc.status || 'ready');
  return {
    material_id: doc.material_id,
    subject: legacyField(doc.subject),
    topic: legacyField(doc.topic),
    grade: typeof doc.grade === 'number' ? doc.grade : '',
    chapter: typeof doc.chapter === 'number' ? doc.chapter : '',
    filename: doc.filename,
    size: doc.size,
    status,
    createdAt: doc.createdAt,
    setId: doc.setId,
    uploader: doc.uploader || 'docent',
    segments,
    segmentsCount: segments,
    pagesCount: segments,
    active: !!doc.active,
  };
}

async function extractTextFromBuffer(mime, buffer) {
  try {
    if (mime === PDF) {
      const res = await pdf(buffer);
      return String(res?.text || '');
    }
    if (mime === DOCX) {
      const res = await mammoth.extractRawText({ buffer });
      return String(res?.value || '');
    }
  } catch (_) {
    // ignore
  }
  return '';
}

async function ocrWithOCRSpace(buffer, mime, filename) {
  if (!OCR_SPACE_API_KEY) return { text: '', used: false };
  try {
    const fd = new FormData();
    const blob = new Blob([buffer], { type: mime || PDF });
    fd.append('file', blob, filename || 'upload.pdf');
    fd.append('language', 'dut'); // Dutch OCR
    fd.append('isOverlayRequired', 'false');
    fd.append('scale', 'true');
    fd.append('OCREngine', '2');
    const r = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { 'apikey': OCR_SPACE_API_KEY },
      body: fd,
    });
    const j = await r.json().catch(() => ({}));
    const parsed = Array.isArray(j?.ParsedResults) && j.ParsedResults[0]?.ParsedText ? j.ParsedResults[0].ParsedText : '';
    return { text: String(parsed || ''), used: Boolean(parsed) };
  } catch (_) {
    return { text: '', used: false };
  }
}

function sanitizeText(text) {
  if (!text) return '';
  // collapse excessive whitespace and normalize
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
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return err(400, 'Content-Type moet multipart/form-data zijn.', 'materials/upload', { db_ok: false }, new Headers({ 'X-Debug': 'upload:bad_content_type' }));
    }

    let formData;
    try {
      formData = await req.formData();
    } catch {
      return err(400, 'Kon multipart-gegevens niet lezen.', 'materials/upload', { db_ok: false }, new Headers({ 'X-Debug': 'upload:formdata_error' }));
    }

    const file = formData.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') {
      return err(400, 'Bestand ontbreekt (veld: file).', 'materials/upload', { db_ok: false }, new Headers({ 'X-Debug': 'upload:no_file' }));
    }

    const subject = formData.get('subject') || '';
    const topic = formData.get('topic') || '';
    const gradeRaw = formData.get('grade');
    const chapterRaw = formData.get('chapter');
    const grade = gradeRaw !== null && gradeRaw !== undefined && String(gradeRaw).trim() !== '' ? Number(gradeRaw) : null;
    const chapter = chapterRaw !== null && chapterRaw !== undefined && String(chapterRaw).trim() !== '' ? Number(chapterRaw) : null;

    const mime = file.type || 'application/octet-stream';
    const filename = file.name || `upload-${Date.now()}`;

    if (![PDF, DOCX].includes(mime)) {
      return err(400, 'Alleen PDF of DOCX zijn toegestaan.', 'materials/upload', { db_ok: false }, new Headers({ 'X-Debug': 'upload:not_allowed_mime' }));
    }

    if (typeof file.size === 'number' && file.size > MAX_BYTES) {
      return err(413, `Bestand te groot (max ${MAX_BYTES} bytes).`, 'materials/upload', { db_ok: false }, new Headers({ 'X-Debug': 'upload:too_large' }));
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      return err(413, `Bestand te groot (max ${MAX_BYTES} bytes).`, 'materials/upload', { db_ok: false }, new Headers({ 'X-Debug': 'upload:too_large_buf' }));
    }

    try {
      const db = await getDatabase();
      const bucket = new GridFSBucket(db, { bucketName: BUCKET_NAME });

      const uploadStream = bucket.openUploadStream(filename, {
        contentType: mime,
        metadata: { subject, topic, grade, chapter },
      });
      await new Promise((resolve, reject) => {
        uploadStream.on('error', reject);
        uploadStream.on('finish', resolve);
        uploadStream.end(buffer);
      });

      const fileId = uploadStream.id?.toString?.() || String(uploadStream.id);
      const materials = db.collection('materials');
      const segmentsCol = db.collection('material_segments');

      const material_id = `mat_${randomUUID()}`;
      const nowIso = new Date().toISOString();
      const type = detectType(mime, filename);
      const baseDoc = {
        material_id,
        id: material_id,
        setId: material_id,
        kind: 'set',
        ready: true,
        filename,
        mime,
        type,
        size: buffer.length,
        status: 'ready',
        createdAt: nowIso,
        uploader: 'docent',
        segments: 0,
        subject: subject || null,
        topic: topic || null,
        grade,
        chapter,
        storage: { driver: 'gridfs', bucket: BUCKET_NAME, file_id: fileId },
        created_at: nowIso,
        active: false,
      };

      // Extract and store segments synchronously
      let extracted = await extractTextFromBuffer(mime, buffer);
      let ocrUsed = false;
      if ((!extracted || extracted.trim().length < 10) && OCR_ENABLED && OCR_PROVIDER === 'ocrspace' && mime === PDF) {
        const ocr = await ocrWithOCRSpace(buffer, mime, filename);
        if (ocr.used && ocr.text) { extracted = ocr.text; ocrUsed = true; }
      }
      extracted = sanitizeText(extracted);
      let segCount = 0;
      if (extracted && extracted.length > 0) {
        const chunks = chunkText(extracted, 1800).slice(0, 60); // hard cap ~108k chars
        const docs = chunks.map((t) => ({
          segment_id: `seg_${randomUUID()}`,
          material_id,
          text: t,
          tokens: Math.max(10, Math.round(t.length / 4)),
          created_at: nowIso,
        }));
        if (docs.length) {
          await segmentsCol.insertMany(docs);
          segCount = docs.length;
        }
      }

      const finalDoc = { ...baseDoc, segments: Math.max(1, segCount) };
      await materials.insertOne(finalDoc);

      const legacyMat = toLegacyMaterial(finalDoc);

      const body = LEGACY
        ? {
            db_ok: true,
            file: { filename, mime, size: buffer.length },
            material: legacyMat,
            storage: { driver: 'gridfs', file_id: fileId },
          }
        : {
            db_ok: true,
            file: { filename, mime, size: buffer.length },
            material: finalDoc,
            storage: { driver: 'gridfs', file_id: fileId },
          };

      const debug = segCount > 0 ? (ocrUsed ? 'upload:stored_with_segments|ocr' : 'upload:stored_with_segments') : 'upload:stored_no_segments';
      const headers = new Headers({ 'X-Studiebot-Storage': 'gridfs', 'X-Debug': debug });
      if (ocrUsed) headers.set('X-OCR', 'ocrspace');
      return ok(body, 200, headers);
    } catch (dbError) {
      return err(500, `Opslag in database mislukt: ${dbError?.message || 'onbekende fout'}.`, 'materials/upload', { db_ok: false }, new Headers({ 'X-Debug': 'upload:db_error' }));
    }
  } catch (e) {
    return err(500, 'Onverwachte serverfout bij upload.', 'materials/upload', { db_ok: false }, new Headers({ 'X-Debug': 'upload:server_error' }));
  }
}