import 'server-only';
import { getDatabase } from './mongoClient';

/**
 * Fetch study materials by criteria
 * @param {Object} criteria - Search criteria
 * @param {string} criteria.subject - Subject name
 * @param {string} criteria.grade - Grade/year level
 * @param {string} criteria.chapter - Chapter identifier
 * @param {string} criteria.topic - Topic identifier
 * @returns {Promise<Object[]>} Array of matching materials
 */
export async function fetchMaterials({ subject, grade, chapter, topic } = {}) {
  try {
    const db = await getDatabase();
    const collection = db.collection('materials');
    
    // Build query selector, handling missing fields gracefully
    const selector = {};
    if (subject) selector.subject = subject;
    if (grade) selector.grade = grade;
    if (chapter) selector.chapter = chapter;
    if (topic) selector.topic = topic;
    
    // Fetch materials with projection (exclude _id)
    const materials = await collection
      .find(selector, { projection: { _id: 0 } })
      .limit(100) // Reasonable limit
      .toArray();
    
    return materials;
  } catch (error) {
    console.error('Failed to fetch materials:', error.message);
    return []; // Return empty array on error, don't block
  }
}

/**
 * Get materials count and sample for diagnostics
 * @returns {Promise<Object>} Count and sample data
 */
export async function getMaterialsStats() {
  try {
    const db = await getDatabase();
    const collection = db.collection('materials');
    
    const count = await collection.countDocuments();
    const sample = await collection
      .find({}, { projection: { _id: 0, subject: 1, grade: 1, chapter: 1, topic: 1 } })
      .limit(3)
      .toArray();
    
    return { count, sample };
  } catch (error) {
    console.error('Failed to get materials stats:', error.message);
    return { count: 0, sample: [] };
  }
}

/**
 * Find best matching material for LLM context
 * @param {string} topicId - Topic identifier (e.g., "Nederlands-Hoofdstuk-1")
 * @param {string} subject - Subject name
 * @param {string} grade - Grade level
 * @param {string} chapter - Chapter
 * @returns {Promise<Object|null>} Best matching material or null
 */
export async function findMaterialForLLM(topicId, subject, grade, chapter) {
  try {
    const materials = await fetchMaterials({ subject, grade, chapter });
    
    if (materials.length === 0) {
      return null;
    }
    
    // Try to find most specific match first
    let bestMatch = materials.find(m => 
      m.topic && topicId.toLowerCase().includes(m.topic.toLowerCase())
    );
    
    // Fall back to first material in chapter/subject
    if (!bestMatch) {
      bestMatch = materials[0];
    }
    
    return bestMatch;
  } catch (error) {
    console.error('Failed to find material for LLM:', error.message);
    return null;
  }
}