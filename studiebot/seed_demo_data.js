const { MongoClient } = require('mongodb');

async function seedDemoData() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('studiebot');
    
    // Create test material for mat_demo
    const materials = db.collection('materials');
    const segments = db.collection('material_segments');
    
    // Insert test material
    const materialId = 'mat_demo';
    await materials.deleteMany({ material_id: materialId });
    await segments.deleteMany({ material_id: materialId });
    
    const material = {
      material_id: materialId,
      id: materialId,
      filename: 'demo_material.pdf',
      subject: 'Test',
      grade: 1,
      chapter: 1,
      type: 'pdf',
      size: 512,
      segments: 1,
      status: 'ready',
      active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    await materials.insertOne(material);
    
    // Insert test segment
    const testSegment = {
      material_id: materialId,
      text: 'This is demo material for testing purposes.',
      created_at: new Date().toISOString()
    };
    
    await segments.insertOne(testSegment);
    
    console.log('✅ Demo data seeded successfully');
    console.log(`- Material: ${materialId} (Test, Grade 1, Chapter 1)`);
    console.log(`- Segments: 1`);
    
  } catch (error) {
    console.error('❌ Failed to seed demo data:', error);
  } finally {
    await client.close();
  }
}

seedDemoData();