import { LezenGenerateResponse, LezenQuestion, LezenArticle } from '../../lib/types/lezen';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: string[];
}

/**
 * Validates the generated article meets HAVO2 requirements
 */
export function validateLezenArticle(article: LezenArticle): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Check title exists
  if (!article.title || typeof article.title !== 'string' || article.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Article must have a non-empty title' });
  }

  // Check paragraphs exist and count
  if (!Array.isArray(article.paragraphs) || article.paragraphs.length < 2 || article.paragraphs.length > 4) {
    errors.push({ field: 'paragraphs', message: 'Article must have 2-4 paragraphs' });
  } else {
    // Check paragraph content
    article.paragraphs.forEach((p, index) => {
      if (!p || typeof p !== 'string' || p.trim().length === 0) {
        errors.push({ field: `paragraphs[${index}]`, message: 'Paragraph cannot be empty' });
      }
    });

    // Check total word count (280-600 words)
    const totalText = article.paragraphs.join(' ');
    const wordCount = totalText.split(/\s+/).filter(word => word.length > 0).length;
    
    if (wordCount < 280) {
      errors.push({ field: 'wordCount', message: `Article too short: ${wordCount} words (minimum 280)` });
    } else if (wordCount > 600) {
      errors.push({ field: 'wordCount', message: `Article too long: ${wordCount} words (maximum 600)` });
    }

    // Check emoji count (max 3 per paragraph)
    article.paragraphs.forEach((p, index) => {
      const emojiCount = (p.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
      if (emojiCount > 3) {
        warnings.push(`Paragraph ${index + 1} has ${emojiCount} emojis (max 3 recommended)`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Validates the generated questions meet CITO requirements
 */
export function validateLezenQuestions(questions: LezenQuestion[], articleText: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Must have exactly 5 questions
  if (!Array.isArray(questions) || questions.length !== 5) {
    errors.push({ field: 'questions', message: `Must have exactly 5 questions, got ${questions?.length || 0}` });
    return { isValid: false, errors, warnings };
  }

  questions.forEach((q, index) => {
    // Check question structure
    if (!q.id || typeof q.id !== 'string') {
      errors.push({ field: `questions[${index}].id`, message: 'Question must have valid ID' });
    }

    if (!q.question || typeof q.question !== 'string' || q.question.trim().length === 0) {
      errors.push({ field: `questions[${index}].question`, message: 'Question must have non-empty question text' });
    }

    // Check choices (exactly 4, labeled A-D)
    if (!Array.isArray(q.choices) || q.choices.length !== 4) {
      errors.push({ field: `questions[${index}].choices`, message: 'Question must have exactly 4 choices' });
    } else {
      q.choices.forEach((choice, choiceIndex) => {
        if (!choice || typeof choice !== 'string' || choice.trim().length === 0) {
          errors.push({ field: `questions[${index}].choices[${choiceIndex}]`, message: 'Choice cannot be empty' });
        }
        
        // Check if choice starts with A/B/C/D
        const expectedLabel = String.fromCharCode(65 + choiceIndex); // A, B, C, D
        if (!choice.trim().startsWith(expectedLabel)) {
          warnings.push(`Question ${index + 1} choice ${choiceIndex + 1} should start with "${expectedLabel}"`);
        }
      });

      // Check for duplicate choices
      const uniqueChoices = new Set(q.choices.map(c => c.toLowerCase().trim()));
      if (uniqueChoices.size !== q.choices.length) {
        warnings.push(`Question ${index + 1} has duplicate or very similar choices`);
      }
    }

    // Check correct answer index
    if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) {
      errors.push({ field: `questions[${index}].correctIndex`, message: 'correctIndex must be 0-3' });
    }

    // Check explanation
    if (!q.explanation || typeof q.explanation !== 'string' || q.explanation.trim().length === 0) {
      errors.push({ field: `questions[${index}].explanation`, message: 'Question must have explanation' });
    }

    // Check for trivial copying from article (>70% overlap warning)
    if (q.question && articleText) {
      const questionWords = q.question.toLowerCase().split(/\s+/);
      const articleWords = new Set(articleText.toLowerCase().split(/\s+/));
      const overlapping = questionWords.filter(word => articleWords.has(word));
      const overlapPercent = (overlapping.length / questionWords.length) * 100;
      
      if (overlapPercent > 70) {
        warnings.push(`Question ${index + 1} has ${overlapPercent.toFixed(1)}% word overlap with article (>70% may be too trivial)`);
      }
    }
  });

  // Check question type variety (should have different types)
  const questionTypes = ['begrip', 'argumentatie', 'structuur', 'interpretatie', 'evaluatie'];
  if (questions.length === 5) {
    // This is a basic check - in a full implementation we'd analyze question content
    warnings.push('Ensure questions cover: begrip, argumentatie, structuur, interpretatie, evaluatie types');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Main validation function for complete Lezen response
 */
export function validateLezenResponse(response: LezenGenerateResponse): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Validate article
  const articleValidation = validateLezenArticle(response.article);
  errors.push(...articleValidation.errors);
  if (articleValidation.warnings) {
    warnings.push(...articleValidation.warnings);
  }

  // Validate questions
  const articleText = response.article?.paragraphs?.join(' ') || '';
  const questionsValidation = validateLezenQuestions(response.questions, articleText);
  errors.push(...questionsValidation.errors);
  if (questionsValidation.warnings) {
    warnings.push(...questionsValidation.warnings);
  }

  // Validate meta
  if (!response.meta?.readingLevel) {
    errors.push({ field: 'meta.readingLevel', message: 'Reading level must be specified' });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}