export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../infra/db/mongoClient';
import { GridFSBucket } from 'mongodb';
import { randomUUID } from 'crypto';
import formidable from 'formidable';
import { Readable } from 'stream';

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

async function parseMultipart(req) {
  // Convert Next.js Request to Node stream for formidable
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    throw new Error('Content-Type moet multipart/form-data zijn.');
  }

  const form = formidable({
    maxFileSize: MAX_BYTES,
    multiples: false,
    allowEmptyFiles: false,
    filter: ({ mimetype }) => mimetype === 'application/pdf',
  });

  const arrayBuffer = await req.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  const stream = Readable.from(buf);
  stream.headers = { 'content-type': contentType };

  return await new Promise((resolve, reject) => {
    form.parse(stream, (err, fields, files) => {
      if (err) return reject(err);
      const file = files.file;
      // formidable v3 returns objects or arrays; normalize
      const picked = Array.isArray(file) ? file[0] : file;
      resolve({ fields, file: picked });
    });
  });
}

async function autoIngest(db, material_id, doc) {
  try {
    const ingestRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/materials/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ material_id }),
      cache: 'no-store',
    }).catch(() => null);
    return ingestRes ? true : false;
  } catch {
    return false;
  }
}

export async function POST(req) {
  try {
    let parsed;
    try {
      parsed = await parseMultipart(req);
    } catch (e) {
      return err(400, e.message || 'Kon multipart-gegevens niet lezen.', 'materials/upload', { db_ok: false }, new Headers({ 'X-Debug': 'upload:parse_error' }));
    }

    const { fields, file } = parsed;
    if (!file) {
      return err(400, 'Bestand ontbreekt (veld: file).', 'materials/upload', { db_ok: false }, new Headers({ 'X-Debug': 'upload:no_file' }));
    }

    const subject = (Array.isArray(fields.subject) ? fields.subject[0] : fields.subject) || '';
    const topic = (Array.isArray(fields.topic) ? fields.topic[0] : fields.topic) || '';
    const grade = Number((Array.isArray(fields.grade) ? fields.grade[0] : fields.grade) || '') || null;
    const chapter = Number((Array.isArray(fields.chapter) ? fields.chapter[0] : fields.chapter) || '') || null;

    const filename = file.originalFilename || file.newFilename || `upload-${Date.now()}.pdf`;
    const mime = file.mimetype || 'application/pdf';

    if (mime !== 'application/pdf') {
      return err(400, 'Alleen PDF-bestanden zijn toegestaan (application/pdf).', 'materials/upload', { db_ok: false }, new Headers({ 'X-Debug': 'upload:not_pdf' }));
    }

    if (file.size > MAX_BYTES) {
      return err(413, `Bestand te groot (max ${MAX_BYTES} bytes).`, 'materials/upload', { db_ok: false }, new Headers({ 'X-Debug': 'upload:too_large' }));
    }

    try {
      const db = await getDatabase();
      const bucket = new GridFSBucket(db, { bucketName: BUCKET_NAME });

      // Stream file to GridFS
      const uploadStream = bucket.openUploadStream(filename, {
        contentType: mime,
        metadata: { subject, topic, grade, chapter },
      });

      await new Promise((resolve, reject) => {
        const nodeStream = Readable.from(file.toJSON ? Buffer.from(file.toJSON().buffer) : file.filepath ? undefined : []);
        // If formidable stored the file on disk, pipe from filepath
        if (file.filepath) {
          const fs = require('fs');
          fs.createReadStream(file.filepath)
            .on('error', reject)
            .pipe(uploadStream)
            .on('error', reject)
            .on('finish', resolve);
        } else if (nodeStream && nodeStream.readable) {
          nodeStream
            .on('error', reject)
            .pipe(uploadStream)
            .on('error', reject)
            .on('finish', resolve);
        } else {
          reject(new Error('Kan upload-stream niet openen.'));
        }
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
        size: file.size,
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
      };

      await materials.insertOne(doc);

      // Optional auto-ingest to bump segments to 1 so UI shows immediately
      await autoIngest(db, material_id, doc);

      return ok({
        db_ok: true,
        file: { filename, mime, size: file.size },
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
      }, 200, new Headers({ 'X-Studiebot-Storage': 'gridfs', 'X-Debug': 'upload:stored_v3' }));
    } catch (dbError) {
      return err(500, `Opslag in database mislukt: ${dbError?.message || 'onbekende fout'}.`, 'materials/upload', { db_ok: false }, new Headers({ 'X-Debug': 'upload:db_error' }));
    }
  } catch (e) {
    return err(500, 'Onverwachte serverfout bij upload.', 'materials/upload', { db_ok: false }, new Headers({ 'X-Debug': 'upload:server_error' }));
  }
}