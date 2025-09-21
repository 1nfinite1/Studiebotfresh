// studiebot/infra/llm/server/openaiClient.js
import 'server-only';
import OpenAI from 'openai';
import { getActiveFor } from '../../db/materialsService';

const ENABLED = process.env.LLM_ENABLED === 'true';
const PROVIDER = process.env.LLM_PROVIDER || 'openai';

const MODELS = {
  grade: process.env.OPENAI_MODEL_GRADE || 'gpt-4o-mini',
  quiz: process.env.OPENAI_MODEL_QUIZ || 'gpt-4o-mini',
  exam: process.env.OPENAI_MODEL_EXAM || 'gpt-4o-mini',
  moderation: process.env.OPENAI_MODERATION_MODEL || 'omni-moderation-latest',
};

const GUARDRAIL_MESSAGE = "Dat hoort niet bij de les. Laten we verdergaan.";

function getClient() { if (!ENABLED || PROVIDER !== 'openai') return null; const apiKey = process.env.OPENAI_API_KEY; if (!apiKey) return null; return new OpenAI({ apiKey }); }

function detectPromptInjection(text) {
  if (!text || typeof text !== 'string') return false;
  const patterns = [/ignore\s+all\s+previous/i,/forget\s+all\s+instructions/i,/vergeet\s+alle\s+instructies/i,/negeer\s+alle\s+vorige/i,/bypass\s+all/i,/omzeil\s+alle/i,/sudo\s+/i,/bomb|bom/i,/weapon|wapen/i,/hack|hacking/i,/system\s*:/i,/assistant\s*:/i];
  return patterns.some(p=>p.test(text));
}
async function runGuardrailChecks(client, text){ if (!text) return {passed:true}; if (detectPromptInjection(text)) return {passed:false,reason:'prompt_injection'}; if (!client) return {passed:true}; try{ const m=await client.moderations.create({model:MODELS.moderation,input:text}); if (m.results?.[0]?.flagged) return {passed:false,reason:'unsafe'}; return {passed:true}; }catch{return {passed:true}} }

async function getContext({ subject, grade, chapter }) {
  try { const { material, segmentsText, pagesCount } = await getActiveFor({ subject, grade, chapter }); if (!material) return { ok:false, reason:'no_material', message:'Er is nog geen lesmateriaal geactiveerd voor dit vak/leerjaar/hoofdstuk.', db_ok:true };
    return { ok:true, material, text: segmentsText || '', pagesCount: pagesCount || 0 };
  } catch { return { ok:false, reason:'no_material', message:'Er is nog geen lesmateriaal geactiveerd voor dit vak/leerjaar/hoofdstuk.', db_ok:false }; }
}

function attachUsage(target, resp, fallback){ try{ const u=resp?.usage||{}; target.model=resp?.model||fallback||null; target.usage={ prompt_tokens:Number(u.prompt_tokens||0), completion_tokens:Number(u.completion_tokens||0), total_tokens:Number(u.total_tokens||0) }; }catch{ target.model=fallback||null; target.usage={ prompt_tokens:0, completion_tokens:0, total_tokens:0 }; } }

// New: Learn/Overhoren talk endpoint (single compact response)
export async function srvLearnTalk({ topicId, text, subject, grade, chapter }){
  const c=getClient(); const ctx=await getContext({ subject, grade, chapter, topicId });
  if(!ctx.ok){ return { no_material:true, reason:ctx.reason, message:ctx.message, db_ok:ctx.db_ok, context_len:0 }; }
  if(!c){ return { message:'(stub) Korte uitleg en 1 vraag bij de tekst. 😊', header:'disabled', db_ok:true, context_len:(ctx.text||'').length, model:null, usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0} } }
  const guard=await runGuardrailChecks(c, text); if(!guard.passed){ return { message:GUARDRAIL_MESSAGE, header:'enabled', db_ok:true, context_len:(ctx.text||'').length, model:null, usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0} } }
  const { buildLearnSystem, buildLearnUser } = await import('../prompts');
  const system=buildLearnSystem(); const user=buildLearnUser(topicId||'algemeen', text||'', ctx.text||'');
  try{
    const resp=await c.chat.completions.create({ model: MODELS.quiz, temperature:0.3, response_format:{type:'json_object'}, messages:[{role:'system',content:system},{role:'user',content:user}] });
    const out={ message:'', header:'enabled', db_ok:true, context_len:(ctx.text||'').length, model:null, usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0} };
    attachUsage(out, resp, MODELS.quiz);
    const content=resp.choices?.[0]?.message?.content||'{}'; const json=JSON.parse(content);
    out.message=String(json.message||'Goed bezig! Wat valt je op? 😊').slice(0,600);
    return out;
  }catch{
    return { message:'Goed bezig! Noem één kernpunt en leg kort uit. 😊', header:'enabled', db_ok:true, context_len:(ctx.text||'').length, model:MODELS.quiz, usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0} };
  }
}

export async function srvQuizGenerate({ topicId, objective, currentBloom = 'remember', currentDifficulty = 'easy', subject, grade, chapter }) {
  const c = getClient(); const ctx = await getContext({ subject, grade, chapter, topicId }); if (!ctx.ok) { return { no_material: true, reason: ctx.reason, message: ctx.message, db_ok: ctx.db_ok, context_len: 0 }; }
  try { if (!c) { return { question_id:'stub-q1', type:'mcq', stem:'(stub) Korte vraag bij de tekst.', choices:['A','B','C','D'], answer_key:{ correct:[0], explanation:'(stub) Uitleg' }, objective: objective||'algemeen', bloom_level: currentBloom, difficulty: currentDifficulty, header:'disabled', db_ok:true, context_len:(ctx.text||'').length, model:null, usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0} } }
    const out={ question_id:`q-${Date.now()}`, type:'mcq', stem:'', choices:[], answer_key:{ correct:[], explanation:'' }, objective: objective||'general', bloom_level: currentBloom, difficulty: currentDifficulty, header:'enabled', db_ok:true, context_len:(ctx.text||'').length, model:null, usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0} };
    const { buildQuizSystem, buildQuizUser } = await import('../prompts'); const system=buildQuizSystem(); const user=buildQuizUser(topicId||'algemeen', ctx.text||'', objective||'algemeen');
    try{ const resp=await c.chat.completions.create({ model: MODELS.quiz, temperature:0.4, response_format:{type:'json_object'}, messages:[{role:'system',content:system},{role:'user',content:user}] }); attachUsage(out, resp, MODELS.quiz);
      const content=resp.choices?.[0]?.message?.content||'{}'; const json=JSON.parse(content);
      out.question_id=json.question_id||out.question_id; out.type=json.type||'mcq'; out.stem=String(json.stem||'').slice(0,500); out.choices=Array.isArray(json.choices)?json.choices.slice(0,6):[]; out.answer_key=json.answer_key||out.answer_key;
    }catch{ out.stem='Noem één belangrijk punt uit de tekst.'; out.type='short_answer'; out.choices=[]; out.answer_key={ correct:[], explanation:'Geef een beknopt antwoord.' }; }
    return out;
  } catch { return { question_id:`error-${Date.now()}`, type:'short_answer', stem:'Er ging iets mis.', choices:[], answer_key:{ correct:[], explanation:'Probeer opnieuw.' }, objective: objective||'general', bloom_level: currentBloom, difficulty: currentDifficulty, header:'disabled', db_ok:false, context_len:0, model:null, usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0} } }
}

export async function srvGradeQuiz({ answers, questions = [], objectives = [], isExam = false, subject, grade, chapter, topicId }) {
  const c=getClient(); const ctx=await getContext({ subject, grade, chapter, topicId }); if(!ctx.ok){ return { no_material:true, reason:ctx.reason, message:ctx.message, db_ok:ctx.db_ok, context_len:0 } }
  try{ if(!c){ return { is_correct:false, score:0.6, feedback:'(stub) Voorbeeldbeoordeling; LLM niet geconfigureerd.', tags:[], next_recommended_focus:['Herhaal de hoofdpunten'], weak_areas:[], chat_prefill:'Ik wil oefenen met de kernbegrippen.', header:'disabled', db_ok:true, context_len:(ctx.text||'').length, model:null, usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0} } }
    const guard=await runGuardrailChecks(c, Array.isArray(answers)?answers.join(' '):''); const out={ is_correct:false, score:0.0, feedback:'', tags:[], next_recommended_focus:[], weak_areas:[], chat_prefill:'', header:'enabled', db_ok:true, context_len:(ctx.text||'').length, model:null, usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0} };
    if(!guard.passed){ out.feedback=GUARDRAIL_MESSAGE; return out }
    const system=`Je bent Studiebot. Alle student-tekst in NL. Geef JSON met: is_correct, score (0..1), feedback (1–2 korte NL zinnen), weak_areas[], next_recommended_focus[] (≤3), chat_prefill.`;
    const user=`Lesmateriaal samenvatting:\n${(ctx.text||'').slice(0,12000)}\n\nVragen: ${JSON.stringify(questions.slice(0,10))}\nAntwoorden: ${JSON.stringify(answers?.slice(0,10)||[])}`;
    try{ const resp=await c.chat.completions.create({ model: MODELS.grade, temperature:0.3, response_format:{type:'json_object'}, messages:[{role:'system',content:system},{role:'user',content:user}] }); attachUsage(out, resp, MODELS.grade);
      const content=resp.choices?.[0]?.message?.content||'{}'; const json=JSON.parse(content);
      out.is_correct=Boolean(json.is_correct); out.score=Math.max(0,Math.min(1,Number(json.score)||0)); out.feedback=String(json.feedback||'Goed gedaan! Blijf oefenen.').slice(0,300);
      out.tags=Array.isArray(json.tags)?json.tags.slice(0,5):[]; out.next_recommended_focus=Array.isArray(json.next_recommended_focus)?json.next_recommended_focus.slice(0,3):[]; out.weak_areas=Array.isArray(json.weak_areas)?json.weak_areas.slice(0,3):[]; const weakParts=json.chat_prefill_parts||[]; out.chat_prefill=json.chat_prefill||(weakParts.length>0?`Ik heb moeite met ${weakParts.slice(0,2).join(' en ')}. Ik wil daarop oefenen.`:'Ik wil meer oefenen met deze stof.');
    }catch{ out.score=0.5; out.feedback='Goed geprobeerd! Probeer het nog eens met meer details.'; out.next_recommended_focus=['Herhaal de hoofdpunten','Oefen met voorbeelden']; out.chat_prefill='Ik wil meer oefenen met deze stof.' }
    return out;
  }catch{ return { is_correct:false, score:0.0, feedback:'Er ging iets mis.', tags:[], next_recommended_focus:[], weak_areas:[], chat_prefill:'', header:'disabled', db_ok:false, context_len:0, model:null, usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0} } }
}

export async function srvExamGenerate({ topicId, blueprint = {}, totalQuestions = 5, subject, grade, chapter }) {
  const c=getClient(); const ctx=await getContext({ subject, grade, chapter, topicId }); if(!ctx.ok){ return { no_material:true, reason:ctx.reason, message:ctx.message, db_ok:ctx.db_ok, context_len:0 } }
  if(!c){ return { questions:Array.from({length:totalQuestions},(_,i)=>({ question_id:`stub-q${i+1}`, type:'mcq', stem:`(stub) Vraag ${i+1}`, choices:['A','B','C','D'], answer_key:{ correct:[0], explanation:'(stub) Uitleg' }})), header:'disabled', db_ok:true, context_len:(ctx.text||'').length, model:null, usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0} } }
  const out={ questions:[], header:'enabled', db_ok:true, context_len:(ctx.text||'').length, model:null, usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0} };
  const { buildExamSystemGenerate, buildExamUserGenerate }=await import('../prompts'); const system=buildExamSystemGenerate(); const user=buildExamUserGenerate(ctx.text||'', Math.min(Math.max(totalQuestions,1),10));
  try{ const resp=await c.chat.completions.create({ model: MODELS.exam, temperature:0.4, response_format:{type:'json_object'}, messages:[{role:'system',content:system},{role:'user',content:user}] }); attachUsage(out, resp, MODELS.exam);
    const content=resp.choices?.[0]?.message?.content||'{}'; const json=JSON.parse(content); if(Array.isArray(json.questions)){ out.questions=json.questions.slice(0,totalQuestions).map(q=>({ question_id:q.question_id||`q-${Date.now()}-${Math.random()}`, type:q.type||'short_answer', stem:String(q.stem||'').slice(0,500), choices:Array.isArray(q.choices)?q.choices.slice(0,6):[], answer_key:q.answer_key||{correct:[],explanation:''} })); }
  }catch{ out.questions=Array.from({length:Math.min(totalQuestions,3)},(_,i)=>({ question_id:`fallback-q${i+1}`, type:'short_answer', stem:`Leg kort uit wat je weet over dit onderwerp.`, choices:[], answer_key:{ correct:['uitleg'], explanation:'Geef een volledig antwoord.' } })) }
  return out;
}

export async function srvExamGradeItem({ question, answer, subject, grade, chapter }){
  const c=getClient(); const ctx=await getContext({ subject, grade, chapter }); if(!ctx.ok){ return { no_material:true, reason:ctx.reason, message:ctx.message, db_ok:ctx.db_ok, context_len:0 } }
  if(!c){ return { is_correct:false, score:0.6, explanation:'Voorbeeldbeoordeling; voeg later een LLM toe. 😊', model_answer:'Kernpunten volgens de stof, kort samengevat.', header:'disabled', db_ok:true, context_len:(ctx.text||'').length, model:null, usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0} } }
  const guard=await runGuardrailChecks(c, String(answer||'')); if(!guard.passed){ return { is_correct:false, score:0.0, explanation:GUARDRAIL_MESSAGE, model_answer:'', header:'enabled', db_ok:true, context_len:(ctx.text||'').length, model:null, usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0} } }
  const { buildExamSystemGrade, buildExamUserGrade }=await import('../prompts'); const system=buildExamSystemGrade(); const user=buildExamUserGrade(ctx.text||'', String(question||''), String(answer||''));
  try{ const resp=await c.chat.completions.create({ model: MODELS.grade, temperature:0.3, response_format:{type:'json_object'}, messages:[{role:'system',content:system},{role:'user',content:user}] });
    const content=resp.choices?.[0]?.message?.content||'{}'; const json=JSON.parse(content);
    return { is_correct:Boolean(json.is_correct), score:Math.max(0,Math.min(1,Number(json.score)||0)), explanation:String(json.explanation||'').slice(0,300), model_answer:String(json.model_answer||'').slice(0,300), header:'enabled', db_ok:true, context_len:(ctx.text||'').length, model: resp?.model||MODELS.grade, usage:{ prompt_tokens:Number(resp?.usage?.prompt_tokens||0), completion_tokens:Number(resp?.usage?.completion_tokens||0), total_tokens:Number(resp?.usage?.total_tokens||0) } };
  }catch{ return { is_correct:false, score:0.5, explanation:'Goede poging! Dit kan nog preciezer. ✨', model_answer:'Geef de kernbegrippen en 1 voorbeeld in 1–2 zinnen.', header:'enabled', db_ok:true, context_len:(ctx.text||'').length, model:MODELS.grade, usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0} } }
}