const { MongoClient } = require('mongodb');

async function seedTestData() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('studiebot');
    
    // Create test material for Geschiedenis
    const materials = db.collection('materials');
    const segments = db.collection('material_segments');
    
    // Insert test material
    const materialId = 'mat_active';
    await materials.deleteMany({ material_id: materialId });
    await segments.deleteMany({ material_id: materialId });
    
    const material = {
      material_id: materialId,
      id: materialId,
      filename: 'test_geschiedenis.pdf',
      subject: 'Geschiedenis',
      grade: 2,
      chapter: 1,
      type: 'pdf',
      size: 1024,
      segments: 2,
      status: 'active',
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    await materials.insertOne(material);
    
    // Insert test segments
    const testSegments = [
      {
        material_id: materialId,
        text: 'De Tachtigjarige Oorlog (1566-1648) was een opstand van de Nederlandse gewesten tegen de Spaanse overheersing. Deze oorlog begon als een religieus conflict maar ontwikkelde zich tot een strijd om politieke onafhankelijkheid.',
        created_at: new Date().toISOString()
      },
      {
        material_id: materialId,
        text: 'Willem van Oranje speelde een belangrijke rol in de Nederlandse Opstand. Hij werd de leider van de opstand tegen Filips II van Spanje en wordt beschouwd als de vader van het vaderland.',
        created_at: new Date().toISOString()
      }
    ];
    
    await segments.insertMany(testSegments);
    
    console.log('✅ Test data seeded successfully');
    console.log(`- Material: ${materialId} (Geschiedenis, Grade 2, Chapter 1)`);
    console.log(`- Segments: ${testSegments.length}`);
    
  } catch (error) {
    console.error('❌ Failed to seed test data:', error);
  } finally {
    await client.close();
  }
}

seedTestData();