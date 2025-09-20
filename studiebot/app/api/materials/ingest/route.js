export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../infra/db/mongoClient';
import { GridFSBucket, ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';

function ok(data = {}, status = 200, headers) {
  const base = { ok: true, policy: { guardrail_triggered: false, reason: 'none' } };
  return NextResponse.json({ ...base, ...data }, { status, headers });
}

function err(status, message, where = 'materials/ingest', extra = {}, headers) {
  const base = { ok: false, error: message, where, policy: { guardrail_triggered: false, reason: 'none' } };
  return NextResponse.json({ ...base, ...extra }, { status, headers });
}

async function readPreviewFromGridFS(db, bucketName, fileIdStr) {
  try {
    const bucket = new GridFSBucket(db, { bucketName });
    let oid = null;
    try {
      oid = new ObjectId(fileIdStr);
    } catch {
      oid = null;
    }
    if (!oid) return null;

    const stream = bucket.openDownloadStream(oid);
    const chunks = [];
    let total = 0;
    const LIMIT = 1024; // read up to 1KB as preview
    return await new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        if (total < LIMIT) {
          const slice = chunk.subarray(0, Math.max(0, Math.min(chunk.length, LIMIT - total)));
          chunks.push(slice);
          total += slice.length;
        } else {
          stream.destroy();
        }
      });
      stream.on('end', () => {
        try {
          const buf = Buffer.concat(chunks);
          resolve(buf);
        } catch (e) {
          resolve(null);
        }
      });
      stream.on('error', (e) => resolve(null));
    });
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return err(400, 'Kon JSON niet lezen.', 'materials/ingest', {}, new Headers({ 'X-Debug': 'materials:ingest|bad_json' }));
    }

    const material_id = String(body.material_id || body.setId || '').trim();
    if (!material_id) {
      return err(400, 'material_id of setId is verplicht.', 'materials/ingest', {}, new Headers({ 'X-Debug': 'materials:ingest|missing_id' }));
    }

    const db = await getDatabase();
    const materials = db.collection('materials');
    const segmentsCol = db.collection('material_segments');

    const doc = await materials.findOne({
      $or: [
        { material_id },
        { id: material_id },
        { setId: material_id },
      ],
    });
    if (!doc) {
      return err(404, 'Materiaal niet gevonden.', 'materials/ingest', { material_id }, new Headers({ 'X-Debug': 'materials:ingest|not_found' }));
    }

    // Try to read a small preview from GridFS; fallback to filename
    let preview = null;
    const fileIdStr = doc?.storage?.file_id || null;
    const bucketName = doc?.storage?.bucket || 'uploads';
    if (fileIdStr) {
      const buf = await readPreviewFromGridFS(db, bucketName, fileIdStr);
      if (buf && buf.length) {
        const sample = buf.subarray(0, Math.min(buf.length, 64)).toString('hex').slice(0, 64);
        preview = `Preview bytes (hex): ${sample}`;
      }
    }
    if (!preview) {
      preview = doc?.filename ? `Stub from filename: ${doc.filename}` : 'Placeholder segment extracted from PDF.';
    }

    const segment_id = `seg_${randomUUID()}`;
    const tokens = Math.max(10, Math.round(preview.length / 4));
    const segmentDoc = {
      segment_id,
      material_id,
      text: preview,
      tokens,
      created_at: new Date().toISOString(),
    };
    await segmentsCol.insertOne(segmentDoc);

    const count = await segmentsCol.countDocuments({ material_id });
    await materials.updateOne(
      { _id: doc._id },
      { $set: { segments: count, updated_at: new Date().toISOString() } }
    );

    return ok(
      { material_id, segments: count },
      200,
      new Headers({ 'X-Debug': 'materials:ingest|created_segments' })
    );
  } catch (e) {
    return err(500, 'Onverwachte serverfout bij ingest.', 'materials/ingest', {}, new Headers({ 'X-Debug': 'materials:ingest|server_error' }));
  }
}