export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../infra/db/mongoClient';
import { GridFSBucket } from 'mongodb';
import { randomUUID } from 'crypto';

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const BUCKET_NAME = process.env.GRIDFS_BUCKET || 'uploads';
const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

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
    const grade = gradeRaw !== null && gradeRaw !== undefined ? Number(gradeRaw) : null;
    const chapter = chapterRaw !== null && chapterRaw !== undefined ? Number(chapterRaw) : null;

    const mime = file.type || 'application/octet-stream';
    const filename = file.name || `upload-${Date.now()}`;

    // Accept PDF and DOCX
    if (![PDF, DOCX].includes(mime)) {
      return err(400, 'Alleen PDF of DOCX zijn toegestaan.', 'materials/upload', { db_ok: false }, new Headers({ 'X-Debug': 'upload:not_allowed_mime' }));
    }

    // size checks
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

      // 1) Save file to GridFS
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

      // 2) Create material doc (segments start at 0)
      const materials = db.collection('materials');
      const material_id = `mat_${randomUUID()}`;
      const nowIso = new Date().toISOString();
      const type = detectType(mime, filename);
      const doc = {
        material_id,
        id: material_id,
        setId: material_id,
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
      await materials.insertOne(doc);

      // 3) Synchronous stub-ingest: immediately create 1 segment and update segments count
      const segmentsCol = db.collection('material_segments');
      const segment_id = `seg_${randomUUID()}`;
      const preview = doc.filename ? `Stub from filename: ${doc.filename}` : 'Placeholder segment';
      await segmentsCol.insertOne({
        segment_id,
        material_id,
        text: preview,
        tokens: Math.max(10, Math.round(preview.length / 4)),
        created_at: nowIso,
      });
      const newCount = await segmentsCol.countDocuments({ material_id });
      await materials.updateOne({ material_id }, { $set: { segments: newCount } });

      return ok({
        db_ok: true,
        file: { filename, mime, size: buffer.length },
        material: {
          material_id,
          subject: doc.subject,
          topic: doc.topic,
          grade: doc.grade,
          chapter: doc.chapter,
          filename: doc.filename,
          size: doc.size,
          status: doc.status,
          createdAt: doc.createdAt,
          setId: doc.setId,
          uploader: doc.uploader,
          segments: newCount,
        },
        storage: { driver: 'gridfs', file_id: fileId },
      }, 200, new Headers({ 'X-Studiebot-Storage': 'gridfs', 'X-Debug': 'upload:stored_sync_ingest' }));
    } catch (dbError) {
      return err(500, `Opslag in database mislukt: ${dbError?.message || 'onbekende fout'}.`, 'materials/upload', { db_ok: false }, new Headers({ 'X-Debug': 'upload:db_error' }));
    }
  } catch (e) {
    return err(500, 'Onverwachte serverfout bij upload.', 'materials/upload', { db_ok: false }, new Headers({ 'X-Debug': 'upload:server_error' }));
  }
}