export const runtime = 'nodejs';
import { getMaterialsStats } from '../../../infra/db/materialsService';

export async function GET() {
  try {
    const stats = await getMaterialsStats();
    
    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    return new Response(JSON.stringify({ count: 0, sample: [], error: 'Failed to fetch materials' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}