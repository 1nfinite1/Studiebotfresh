// Types for Studiebot Lezen module
export interface LezenArticle {
  title: string;
  paragraphs: string[];
}

export interface LezenQuestion {
  id: string;
  question: string;
  choices: string[]; // Always 4 choices A-D
  correctIndex: number; // 0-3 for A-D
  explanation: string;
}

export interface LezenGenerateRequest {
  topic: string;
  level: string; // e.g., "havo2"
}

export interface LezenGenerateResponse {
  article: LezenArticle;
  questions: LezenQuestion[];
  meta: {
    readingLevel: string;
    sourceStyle: string;
  };
}

export interface LezenAnswerState {
  [questionId: string]: number; // Selected choice index (0-3)
}

export interface LezenFeedback {
  questionId: string;
  isCorrect: boolean;
  explanation: string;
  emoji: string;
}

// Predefined topics configuration
export const LEZEN_FIXED_TOPICS = [
  'Reizen',
  'TikTok',
  'Tweede Wereldoorlog',
  'Gaming',
  'Klimaatverandering',
  'Cristiano Ronaldo',
  'Muziek',
  'Films',
  'Mode',
  'Sport'
] as const;

export const LEZEN_DYNAMIC_TOPICS = [
  'Sociale media',
  'Voetbal',
  'Technologie',
  'Natuur en dieren',
  'Ruimtevaart',
  'Koken en eten',
  'Vriendschap',
  'School en studie',
  'Familie',
  'Vakantie'
] as const;

export const LEZEN_ALL_TOPICS = [...LEZEN_FIXED_TOPICS, ...LEZEN_DYNAMIC_TOPICS] as const;

export type LezenTopic = typeof LEZEN_ALL_TOPICS[number];