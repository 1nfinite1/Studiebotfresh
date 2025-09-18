export const runtime = 'nodejs';

export async function GET() {
  const diag = {
    provider: process.env.LLM_PROVIDER || null,
    enabledFlag: process.env.LLM_ENABLED || null,
    hasApiKey: !!process.env.OPENAI_API_KEY,
    modelHints: process.env.OPENAI_MODEL_HINTS || null,
    modelGrade: process.env.OPENAI_MODEL_GRADE || null,
    moderation: process.env.OPENAI_MODERATION_MODEL || null,
  };
  return new Response(JSON.stringify(diag), {
    headers: { 'Content-Type': 'application/json' }, 
    status: 200
  });
}