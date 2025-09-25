export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { LezenGenerateRequest, LezenGenerateResponse } from '../../../../lib/types/lezen';
import { validateLezenResponse } from '../../../../backend/lezen/validate';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import OpenAI from 'openai';

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
    throw new Error('Failed to load prompt template');
  }

  // Initialize OpenAI client
  const apiKey = process.env.EMERGENT_LLM_KEY;
  if (!apiKey) {
    throw new Error('EMERGENT_LLM_KEY not configured');
  }

  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.emergentmind.com/v1', // Use emergent endpoint
  });

  // Format the user message with the topic
  const userMessage = promptTemplate.user_message.replace('{topic}', request.topic);

  try {
    console.log('Making OpenAI request for topic:', request.topic);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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
      temperature: 0.7,
      max_tokens: 2000,
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
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError);
      console.error('Response text:', response);
      throw new Error('LLM response was not valid JSON');
    }

    // Validate the response
    const validation = validateLezenResponse(parsedResponse);
    
    if (!validation.isValid) {
      console.error('Validation errors:', validation.errors);
      // Try regeneration once if validation fails
      console.log('Attempting regeneration due to validation errors...');
      
      const retryCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: promptTemplate.system_message
          },
          {
            role: 'user',
            content: userMessage
          },
          {
            role: 'assistant',
            content: response
          },
          {
            role: 'user',
            content: `The previous response had validation errors: ${validation.errors.map(e => e.message).join(', ')}. Please generate a corrected version following the exact JSON structure required.`
          }
        ],
        temperature: 0.5,
        max_tokens: 2000,
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
        const retryValidation = validateLezenResponse(parsedResponse);
        if (!retryValidation.isValid) {
          throw new Error(`Validation failed after retry: ${retryValidation.errors.map(e => e.message).join(', ')}`);
        }
      } catch (retryError) {
        console.error('Retry also failed:', retryError);
        throw new Error('Failed to generate valid content after retry');
      }
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