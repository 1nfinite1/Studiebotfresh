export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { LezenGenerateRequest, LezenGenerateResponse } from '../../../../lib/types/lezen';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Import the project's LLM infrastructure
const getClient = () => {
  const ENABLED = process.env.LLM_ENABLED === 'true';
  const PROVIDER = process.env.LLM_PROVIDER || 'openai';
  
  if (!ENABLED || PROVIDER !== 'openai') return null;
  
  // Try multiple API key sources
  const apiKey = process.env.OPENAI_API_KEY || process.env.EMERGENT_LLM_KEY;
  if (!apiKey) return null;
  
  // Dynamic import to avoid the linting issue
  const OpenAI = require('openai');
  return new OpenAI.default({ apiKey });
};

const MODEL_LEZEN = process.env.OPENAI_MODEL_LEZEN || 'gpt-4o-mini';

function jsonOk(data: any, headers?: Record<string, string>, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status, headers });
}

function jsonErr(status: number, reason: string, message: string, extra?: any, headers?: Record<string, string>) {
  return NextResponse.json({ ok: false, reason, message, ...extra }, { status, headers });
}

async function generateLezenContent(request: LezenGenerateRequest): Promise<LezenGenerateResponse> {
  // Load the prompt template
  const promptPath = path.join(process.cwd(), 'backend', 'prompts', 'lezen', 'generate.yaml');
  let promptTemplate: any;
  
  try {
    const promptContent = fs.readFileSync(promptPath, 'utf8');
    promptTemplate = yaml.load(promptContent) as any;
  } catch (error) {
    console.error('Failed to load prompt template:', error);
    
    // Fallback inline prompt if YAML file doesn't exist
    promptTemplate = {
      system_message: `Je bent een expert in het maken van educatieve leesteksten en vragen voor Nederlandse middelbare scholieren op HAVO2 niveau.
      
Je taak is het genereren van een artikel van 300-500 woorden (2-4 alinea's) plus exact 5 CITO-achtige meerkeuzevragen.

ARTIKEL EISEN:
- Nederlandse tekst, HAVO2 leesniveau
- 300-500 woorden verdeeld over 2-4 alinea's
- Duidelijke titel
- Feitelijk correct, begrijpelijk, motiverend
- Maximaal 3 emoji per alinea (optioneel)
- Educatief en interessant voor 15-16 jarigen

VRAAG EISEN:
- Exact 5 meerkeuzevragen (A, B, C, D)
- Verplichte vraagtypen: begripsvraag, argumentatievraag, structuurvraag, interpretatievraag, evaluatievraag
- Elke vraag heeft precies één juist antwoord
- Vragen mogen NIET letterlijk kopiëren uit de tekst (herformuleer >70% overlap)
- Keuzes moeten duidelijk verschillend zijn
- Korte uitleg per vraag (max 1 zin)

UITVOERFORMAT (altijd exact deze JSON structuur):
{
  "article": {
    "title": "Titel hier",
    "paragraphs": ["Alinea 1...", "Alinea 2...", "Alinea 3..."]
  },
  "questions": [
    {
      "id": "q1",
      "question": "Wat is het hoofdpunt van de eerste alinea?",
      "choices": ["A Optie 1", "B Optie 2", "C Optie 3", "D Optie 4"],
      "correctIndex": 1,
      "explanation": "Korte uitleg waarom B correct is."
    }
  ],
  "meta": {
    "readingLevel": "havo2",
    "sourceStyle": "explanatory"
  }
}`,
      user_message: `Maak een educatief artikel en 5 vragen over het onderwerp: "{topic}"

Zorg ervoor dat:
- Het artikel interessant is voor HAVO2 leerlingen
- De vragen verschillende denkniveaus testen
- Alles in correct Nederlands is
- De JSON structuur exact klopt
- Het artikel uniek en specifiek is voor dit onderwerp

Onderwerp: {topic}`
    };
  }

  // Initialize OpenAI client using project pattern
  const client = getClient();
  if (!client) {
    throw new Error('OpenAI client not available - LLM disabled or API key not configured');
  }

  // Format the user message with the topic
  const userMessage = promptTemplate.user_message.replace(/\{topic\}/g, request.topic);

  try {
    console.log(`Generating OpenAI content for topic: ${request.topic}`);
    
    const completion = await client.chat.completions.create({
      model: MODEL_LEZEN, // Use environment variable pattern
      messages: [
        {
          role: 'system',
          content: promptTemplate.system_message
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      temperature: 0.8, // Higher temperature for more variation
      max_tokens: 2500,
      presence_penalty: 0.3, // Encourage unique content
      frequency_penalty: 0.2, // Reduce repetitive phrases
    });

    const response = completion.choices[0]?.message?.content;
    
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    console.log('OpenAI response received:', response.substring(0, 200) + '...');

    // Try to parse the JSON response
    let parsedResponse: LezenGenerateResponse;
    
    // Extract JSON from response if it's wrapped in markdown or other text
    let jsonText = response;
    const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    } else {
      // Try to find JSON object in the response
      const jsonObjectMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        jsonText = jsonObjectMatch[0];
      }
    }

    try {
      parsedResponse = JSON.parse(jsonText);
      
      // Basic validation
      if (!parsedResponse.article || !parsedResponse.questions || parsedResponse.questions.length !== 5) {
        throw new Error('Invalid response structure from OpenAI');
      }
      
      // Ensure all questions have correct structure
      parsedResponse.questions.forEach((q, index) => {
        if (!q.id) q.id = `q${index + 1}`;
        if (!Array.isArray(q.choices) || q.choices.length !== 4) {
          throw new Error(`Question ${index + 1} must have exactly 4 choices`);
        }
        if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) {
          throw new Error(`Question ${index + 1} must have valid correctIndex (0-3)`);
        }
      });
      
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError);
      console.error('Response text:', response);
      
      // Try regeneration once if parsing fails
      console.log('Attempting regeneration due to parsing error...');
      
      const retryCompletion = await client.chat.completions.create({
        model: MODEL_LEZEN,
        messages: [
          {
            role: 'system',
            content: promptTemplate.system_message + '\n\nLET OP: Geef ALLEEN geldige JSON terug zonder extra tekst of markdown formatting.'
          },
          {
            role: 'user',
            content: userMessage + '\n\nGeef alleen de JSON structuur terug, geen extra tekst.'
          }
        ],
        temperature: 0.7,
        max_tokens: 2500,
      });
      
      const retryResponse = retryCompletion.choices[0]?.message?.content;
      if (!retryResponse) {
        throw new Error('No response from OpenAI on retry');
      }

      let retryJsonText = retryResponse;
      const retryJsonMatch = retryJsonText.match(/```json\s*([\s\S]*?)\s*```/);
      if (retryJsonMatch) {
        retryJsonText = retryJsonMatch[1];
      } else {
        const retryJsonObjectMatch = retryJsonText.match(/\{[\s\S]*\}/);
        if (retryJsonObjectMatch) {
          retryJsonText = retryJsonObjectMatch[0];
        }
      }

      try {
        parsedResponse = JSON.parse(retryJsonText);
        
        // Ensure structure after retry
        if (!parsedResponse.article || !parsedResponse.questions || parsedResponse.questions.length !== 5) {
          throw new Error('Invalid response structure from OpenAI after retry');
        }
        
      } catch (retryError) {
        console.error('Retry also failed:', retryError);
        throw new Error('Failed to generate valid JSON content after retry');
      }
    }

    // Ensure meta exists
    if (!parsedResponse.meta) {
      parsedResponse.meta = {
        readingLevel: 'havo2',
        sourceStyle: 'explanatory'
      };
    }

    return parsedResponse;
    
  } catch (error) {
    console.error('OpenAI generation failed:', error);
    throw error;
  }
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

    // Generate content using OpenAI
    const response = await generateLezenContent({
      topic: body.topic.trim(),
      level: level
    });

    const headers = {
      'X-Studiebot-LLM': 'enabled',
      'X-Debug': 'lezen:generate|success',
      'X-Topic': body.topic,
      'X-Level': level,
      'X-Model': MODEL_LEZEN,
      'X-Generated-At': new Date().toISOString()
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