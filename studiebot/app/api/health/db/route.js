export const runtime = 'nodejs';
import { testConnection } from '../../../../infra/db/mongoClient';

export async function GET() {
  try {
    const isHealthy = await testConnection();
    
    if (isHealthy) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } else {
      return new Response(JSON.stringify({ ok: false }), {
        headers: { 'Content-Type': 'application/json' },
        status: 503
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ ok: false }), {
      headers: { 'Content-Type': 'application/json' },
      status: 503
    });
  }
}