export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { LezenGenerateRequest, LezenGenerateResponse } from '../../../../lib/types/lezen';
import OpenAI from 'openai';

function jsonOk(data: any, headers?: Record<string, string>, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status, headers });
}

function jsonErr(status: number, reason: string, message: string, extra?: any, headers?: Record<string, string>) {
  return NextResponse.json({ ok: false, reason, message, ...extra }, { status, headers });
}

async function generateLezenContent(request: LezenGenerateRequest): Promise<LezenGenerateResponse> {
  // For now, return mock data since the API key setup will be done later on Vercel
  console.log(`Generating mock content for topic: ${request.topic}`);
  
  // Create a realistic mock response
  const mockResponse: LezenGenerateResponse = {
    article: {
      title: `${request.topic}: Een Fascinerend Onderwerp`,
      paragraphs: [
        `${request.topic} is een onderwerp dat veel mensen aanspreekt en boeit. Het heeft een rijke geschiedenis en speelt een belangrijke rol in onze moderne samenleving. Van jongs af aan komen we ermee in aanraking, en het vormt vaak een belangrijk onderdeel van ons dagelijks leven.`,
        
        `Er zijn verschillende aspecten van ${request.topic.toLowerCase()} die de moeite waard zijn om te onderzoeken. Ten eerste is er de historische ontwikkeling, die laat zien hoe het door de eeuwen heen is geëvolueerd. Ten tweede zijn er de moderne trends die we vandaag de dag zien, die vaak heel anders zijn dan wat mensen vroeger gewend waren.`,
        
        `Wat ${request.topic.toLowerCase()} zo interessant maakt, is de manier waarop het verschillende culturen en generaties met elkaar verbindt. Jongeren hebben vaak een andere kijk op het onderwerp dan ouderen, maar beide perspectieven zijn waardevol. Deze diversiteit zorgt voor levendige discussies en nieuwe inzichten.`,
        
        `De toekomst van ${request.topic.toLowerCase()} ziet er veelbelovend uit. Met nieuwe technologieën en veranderende maatschappelijke normen kunnen we verwachten dat er nog veel ontwikkelingen zullen plaatsvinden. Het blijft daarom belangrijk om op de hoogte te blijven van de laatste trends en ontwikkelingen op dit gebied. 🌟`
      ]
    },
    questions: [
      {
        id: 'q1',
        question: `Wat is volgens de tekst het hoofdkenmerk van ${request.topic.toLowerCase()}?`,
        choices: [
          'A Het heeft alleen historische betekenis',
          'B Het speelt een belangrijke rol in onze moderne samenleving',
          'C Het is alleen interessant voor jongeren',
          'D Het heeft geen invloed op ons dagelijks leven'
        ],
        correctIndex: 1,
        explanation: 'In de eerste alinea wordt duidelijk gesteld dat het een belangrijke rol speelt in onze moderne samenleving.'
      },
      {
        id: 'q2',
        question: 'Welke twee hoofdaspecten worden in de tweede alinea genoemd?',
        choices: [
          'A Geschiedenis en cultuur',
          'B Historische ontwikkeling en moderne trends',
          'C Jongeren en ouderen',
          'D Technologie en tradities'
        ],
        correctIndex: 1,
        explanation: 'De tweede alinea noemt expliciet "historische ontwikkeling" en "moderne trends" als de twee hoofdaspecten.'
      },
      {
        id: 'q3',
        question: 'Hoe wordt in de tekst het verschil tussen generaties beschreven?',
        choices: [
          'A Jongeren hebben gelijk en ouderen niet',
          'B Er zijn geen verschillen tussen generaties',
          'C Beide perspectieven zijn waardevol ondanks de verschillen',
          'D Ouderen begrijpen het onderwerp beter'
        ],
        correctIndex: 2,
        explanation: 'De tekst stelt dat "beide perspectieven waardevol zijn" ondanks de verschillende kijk van jongeren en ouderen.'
      },
      {
        id: 'q4',
        question: 'Wat wordt er in de tekst gezegd over de toekomst?',
        choices: [
          'A De toekomst is onzeker',
          'B Er zullen geen veranderingen meer plaatsvinden',
          'C De toekomst ziet er veelbelovend uit met veel ontwikkelingen',
          'D Alleen technologie zal belangrijk zijn'
        ],
        correctIndex: 2,
        explanation: 'In de laatste alinea wordt gesteld dat "de toekomst er veelbelovend uitziet" en dat er "nog veel ontwikkelingen zullen plaatsvinden".'
      },
      {
        id: 'q5',
        question: 'Welke hoofdboodschap geeft de auteur in deze tekst?',
        choices: [
          'A Het onderwerp is te moeilijk om te begrijpen',
          'B Het onderwerp verbindt mensen en blijft zich ontwikkelen',
          'C Alleen experts kunnen het onderwerp begrijpen',
          'D Het onderwerp is niet meer relevant'
        ],
        correctIndex: 1,
        explanation: 'Door de tekst heen benadrukt de auteur hoe het onderwerp mensen verbindt en zich blijft ontwikkelen.'
      }
    ],
    meta: {
      readingLevel: 'havo2',
      sourceStyle: 'explanatory'
    }
  };

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return mockResponse;
}

export async function POST(req: NextRequest) {
  try {
    const body: LezenGenerateRequest = await req.json().catch(() => ({}));
    
    // Basic validation of request
    if (!body.topic || typeof body.topic !== 'string' || body.topic.trim().length === 0) {
      return jsonErr(400, 'invalid_request', 'Topic is required and must be a non-empty string');
    }

    // Set default level if not provided
    const level = body.level || 'havo2';
    
    console.log(`Generating Lezen content for topic: ${body.topic}, level: ${level}`);

    // Generate content
    const response = await generateLezenContent({
      topic: body.topic.trim(),
      level: level
    });

    const headers = {
      'X-Studiebot-LLM': 'enabled',
      'X-Debug': 'lezen:generate|success',
      'X-Topic': body.topic,
      'X-Level': level
    };

    return jsonOk(response, headers);

  } catch (error) {
    console.error('Lezen generate API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return jsonErr(500, 'generation_error', `Failed to generate content: ${errorMessage}`, {
      timestamp: new Date().toISOString()
    }, {
      'X-Debug': 'lezen:generate|error'
    });
  }
}