export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../infra/db/mongoClient';
import { GridFSBucket } from 'mongodb';
import { randomUUID } from 'crypto';

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const BUCKET_NAME = process.env.GRIDFS_BUCKET || 'uploads';

function ok(data = {}, status = 200, headers) {
  const base = { ok: true, policy: { guardrail_triggered: false, reason: 'none' } };
  return NextResponse.json({ ...base, ...data }, { status, headers });
}

function err(status, message, where = 'materials/upload', extra = {}, headers) {
  const base = { ok: false, error: message, where, policy: { guardrail_triggered: false, reason: 'none' } };
  return NextResponse.json({ ...base, ...extra }, { status, headers });
}

function getBaseUrl(req) {
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('host');
  if (!host) return null;
  return `${proto}://${host}`;
}

async function autoIngest(req, material_id) {
  try {
    const base = getBaseUrl(req);
    if (!base) return false;
    await fetch(`${base}/api/materials/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ material_id }),
      cache: 'no-store',
    });
    return true;
  } catch {
    return false;
  }
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
    const filename = file.name || `upload-${Date.now()}.pdf`;

    if (mime !== 'application/pdf') {
      return err(400, 'Alleen PDF-bestanden zijn toegestaan (application/pdf).', 'materials/upload', { db_ok: false }, new Headers({ 'X-Debug': 'upload:not_pdf' }));
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

      const material_id = `mat_${randomUUID()}`;
      const nowIso = new Date().toISOString();
      const doc = {
        material_id,
        id: material_id,
        setId: material_id,
        filename,
        mime,
        type: 'pdf',
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

      // Auto-ingest to bump segments
      await autoIngest(req, material_id);

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
          segments: doc.segments,
        },
        storage: { driver: 'gridfs', file_id: fileId },
      }, 200, new Headers({ 'X-Studiebot-Storage': 'gridfs', 'X-Debug': 'upload:stored_v4' }));
    } catch (dbError) {
      return err(500, `Opslag in database mislukt: ${dbError?.message || 'onbekende fout'}.`, 'materials/upload', { db_ok: false }, new Headers({ 'X-Debug': 'upload:db_error' }));
    }
  } catch (e) {
    return err(500, 'Onverwachte serverfout bij upload.', 'materials/upload', { db_ok: false }, new Headers({ 'X-Debug': 'upload:server_error' }));
  }
}