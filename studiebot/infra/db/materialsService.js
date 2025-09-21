import 'server-only';
import { getDatabase } from './mongoClient';
import { GridFSBucket, ObjectId } from 'mongodb';

/**
 * Fetch study materials by criteria
 */
export async function fetchMaterials({ subject, grade, chapter, topic } = {}) {
  try {
    const db = await getDatabase();
    const collection = db.collection('materials');
    const selector = {};
    if (subject) selector.subject = subject;
    if (grade !== undefined && grade !== null && grade !== '') selector.grade = typeof grade === 'string' ? Number(grade) || grade : grade;
    if (chapter !== undefined && chapter !== null && chapter !== '') selector.chapter = typeof chapter === 'string' ? Number(chapter) || chapter : chapter;
    if (topic) selector.topic = topic;
    const materials = await collection.find(selector, { projection: { _id: 0 } }).limit(100).toArray();
    return materials;
  } catch (error) {
    console.error('Failed to fetch materials:', error.message);
    return [];
  }
}

/**
 * Get materials count and sample for diagnostics
 */
export async function getMaterialsStats() {
  try {
    const db = await getDatabase();
    const collection = db.collection('materials');
    const count = await collection.countDocuments();
    const sample = await collection.find({}, { projection: { _id: 0, subject: 1, grade: 1, chapter: 1, topic: 1 } }).limit(3).toArray();
    return { count, sample };
  } catch (error) {
    console.error('Failed to get materials stats:', error.message);
    return { count: 0, sample: [] };
  }
}

/**
 * Find best matching material for LLM context (legacy fallback)
 */
export async function findMaterialForLLM(topicId, subject, grade, chapter) {
  try {
    const materials = await fetchMaterials({ subject, grade, chapter });
    if (materials.length === 0) return null;
    let bestMatch = materials.find(m => m.topic && String(topicId || '').toLowerCase().includes(String(m.topic).toLowerCase()));
    if (!bestMatch) bestMatch = materials[0];
    return bestMatch;
  } catch (error) {
    console.error('Failed to find material for LLM:', error.message);
    return null;
  }
}

/**
 * Get the active material for subject/grade/chapter and concatenated segments text
 * Returns { material, segmentsText, pagesCount }
 */
export async function getActiveFor({ subject, grade, chapter } = {}) {
  try {
    const db = await getDatabase();
    const materials = db.collection('materials');
    const segmentsCol = db.collection('material_segments');

    const selector = { active: true };
    const and = [];
    if (subject) and.push({ subject });
    // Normalize grade/chapter and match both number and string forms to avoid contract mismatches
    if (grade !== undefined && grade !== null && grade !== '') {
      const gNum = typeof grade === 'number' ? grade : Number(grade);
      const gStr = typeof grade === 'string' ? grade : String(grade);
      and.push({ $or: [ { grade: gNum }, { grade: gStr } ] });
    }
    if (chapter !== undefined && chapter !== null && chapter !== '') {
      const cNum = typeof chapter === 'number' ? chapter : Number(chapter);
      const cStr = typeof chapter === 'string' ? chapter : String(chapter);
      and.push({ $or: [ { chapter: cNum }, { chapter: cStr } ] });
    }
    if (and.length) selector.$and = and;

    const material = await materials.findOne(selector);
    if (!material) return { material: null, segmentsText: '', pagesCount: 0 };

    const segments = await segmentsCol.find({ material_id: material.material_id }).sort({ created_at: 1 }).limit(200).toArray();
    const pagesCount = segments.length || Math.max(1, Number(material.segments || 0));

    // Safe budget ~6k tokens ≈ ~24k characters (rough approx)
    const MAX_CHARS = 24000;
    let acc = '';
    for (const s of segments) {
      const t = String(s.text || '');
      if ((acc.length + t.length + 2) > MAX_CHARS) break;
      acc += (acc ? '\n\n---\n\n' : '') + t;
    }

    return { material, segmentsText: acc, pagesCount };
  } catch (e) {
    console.error('getActiveFor failed:', e.message);
    return { material: null, segmentsText: '', pagesCount: 0 };
  }
}

/**
 * Delete a material and related data
 * Returns { materials, segments, files }
 */
export async function deleteMaterialCascade(material_id) {
  const db = await getDatabase();
  const materials = db.collection('materials');
  const segmentsCol = db.collection('material_segments');
  const bucket = new GridFSBucket(db, { bucketName: process.env.GRIDFS_BUCKET || 'uploads' });

  const doc = await materials.findOne({ $or: [ { material_id }, { id: material_id }, { setId: material_id } ] });
  if (!doc) return { materials: 0, segments: 0, files: 0 };

  // delete file from GridFS
  let filesDeleted = 0;
  try {
    const fid = doc?.storage?.file_id;
    if (fid) {
      const oid = new ObjectId(fid);
      await bucket.delete(oid);
      filesDeleted = 1;
    }
  } catch {
    // ignore
  }

  const segDel = await segmentsCol.deleteMany({ material_id: doc.material_id });
  const matDel = await materials.deleteOne({ material_id: doc.material_id });

  return { materials: matDel.deletedCount || 0, segments: segDel.deletedCount || 0, files: filesDeleted };
}

/**
 * Read a small preview (first ~1000 chars) from segments or GridFS
 */
export async function previewMaterial(material_id) {
  const db = await getDatabase();
  const materials = db.collection('materials');
  const segmentsCol = db.collection('material_segments');
  const bucket = new GridFSBucket(db, { bucketName: process.env.GRIDFS_BUCKET || 'uploads' });

  const doc = await materials.findOne({ $or: [ { material_id }, { id: material_id }, { setId: material_id } ] });
  if (!doc) return null;

  let snippet = '';
  const seg = await segmentsCol.find({ material_id: doc.material_id }).sort({ created_at: 1 }).limit(3).toArray();
  if (seg && seg.length) {
    snippet = seg.map(s => String(s.text || '')).join('\n\n').slice(0, 1000);
  } else {
    // try gridfs bytes and hex sample
    try {
      const fid = doc?.storage?.file_id;
      if (fid) {
        const oid = new ObjectId(fid);
        const stream = bucket.openDownloadStream(oid);
        const chunks = [];
        let total = 0;
        const LIMIT = 1000;
        await new Promise((resolve, reject) => {
          stream.on('data', (chunk) => {
            const slice = chunk.subarray(0, Math.max(0, Math.min(chunk.length, LIMIT - total)));
            chunks.push(slice);
            total += slice.length;
            if (total >= LIMIT) stream.destroy();
          });
          stream.on('close', resolve);
          stream.on('end', resolve);
          stream.on('error', resolve);
        });
        const buf = Buffer.concat(chunks);
        if (buf.length) snippet = `Preview bytes (hex): ${buf.toString('hex').slice(0, 1000)}`;
      }
    } catch {
      // ignore
    }
  }

  const pagesCount = Math.max(1, Number(doc.segments || 0));
  return {
    id: doc.material_id,
    filename: doc.filename,
    type: doc.type || 'pdf',
    size: doc.size || null,
    pagesCount,
    textSnippet: snippet || 'Geen tekst beschikbaar.',
    firstPage: 1,
    chars: (snippet || '').length,
  };
}