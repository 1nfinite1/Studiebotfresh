export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../infra/db/mongoClient';
import { GridFSBucket } from 'mongodb';
import { randomUUID } from 'crypto';

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const BUCKET_NAME = process.env.GRIDFS_BUCKET || 'uploads';

function jsonOk(data = {}, headers) {
  const base = {
    ok: true,
    policy: { guardrail_triggered: false, reason: 'none' },
  };
  return NextResponse.json({ ...base, ...data }, { status: 200, headers });
}

function jsonErr(status, message, where = 'materials/upload', extra = {}, headers) {
  const base = {
    ok: false,
    error: message,
    where,
    policy: { guardrail_triggered: false, reason: 'none' },
  };
  return NextResponse.json({ ...base, ...extra }, { status, headers });
}

export async function POST(req) {
  try {
    // Only accept multipart/form-data
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return jsonErr(400, 'Content-Type must be multipart/form-data', 'materials/upload', { db_ok: false });
    }

    // Parse form data
    let formData;
    try {
      formData = await req.formData();
    } catch (e) {
      return jsonErr(400, 'Kon formuliergegevens niet lezen (multipart).', 'materials/upload', { db_ok: false });
    }

    const file = formData.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') {
      return jsonErr(400, 'Bestand ontbreekt (field: file).', 'materials/upload', { db_ok: false });
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
      return jsonErr(400, 'Alleen PDF-bestanden zijn toegestaan (application/pdf).', 'materials/upload', { db_ok: false });
    }

    if (typeof file.size === 'number' && file.size > MAX_BYTES) {
      return jsonErr(413, `Bestand te groot (max ${MAX_BYTES} bytes).`, 'materials/upload', { db_ok: false });
    }

    // Read content into memory (acceptable for <=15MB)
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      return jsonErr(413, `Bestand te groot (max ${MAX_BYTES} bytes).`, 'materials/upload', { db_ok: false });
    }

    // Store into GridFS
    let db_ok = false;
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

      // Insert a material metadata document referencing GridFS file
      const materials = db.collection('materials');
      const material_id = `mat_${randomUUID()}`;
      const materialDoc = {
        material_id,
        subject: subject || null,
        topic: topic || null,
        grade: grade,
        chapter: chapter,
        storage: { driver: 'gridfs', bucket: BUCKET_NAME, file_id: fileId },
        created_at: new Date().toISOString(),
      };
      await materials.insertOne(materialDoc);
      db_ok = true;

      const headers = new Headers({ 'X-Studiebot-Storage': 'gridfs' });
      return jsonOk({
        db_ok,
        file: { filename, mime, size: buffer.length },
        material: {
          material_id,
          subject: materialDoc.subject,
          topic: materialDoc.topic,
          grade: materialDoc.grade,
          chapter: materialDoc.chapter,
        },
        storage: { driver: 'gridfs', file_id: fileId },
      }, headers);
    } catch (dbErr) {
      return jsonErr(500, `Opslag in database mislukt: ${dbErr?.message || 'onbekende fout'}.`, 'materials/upload', { db_ok: false });
    }
  } catch (e) {
    return jsonErr(500, 'Onverwachte serverfout bij upload.', 'materials/upload', { db_ok: false });
  }
}

export async function GET() {
  return jsonErr(405, 'Gebruik POST voor uploads (multipart/form-data).', 'materials/upload', { db_ok: true });
}