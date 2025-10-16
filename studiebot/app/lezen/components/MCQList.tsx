// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { LezenQuestion, LezenAnswerState } from '../../../lib/types/lezen';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

interface MCQListProps {
  questions: LezenQuestion[];
  answers: LezenAnswerState;
  onAnswerChange: (questionId: string, choiceIndex: number) => void;
  onAllAnswered?: () => void;
  currentQuestionIndex: number;
  onQuestionChange: (index: number) => void;
}

export function MCQList({ questions, answers, onAnswerChange, onAllAnswered, currentQuestionIndex, onQuestionChange }: MCQListProps) {
  const [collapsedQuestions, setCollapsedQuestions] = useState<Set<string>>(new Set());

  const allAnswered = questions.every(q => answers[q.id] !== undefined);
  const answeredCount = Object.keys(answers).length;
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;


  React.useEffect(() => {
    if (allAnswered && onAllAnswered) onAllAnswered();
  }, [allAnswered, onAllAnswered]);

  const handleAnswerSelect = (questionId: string, choiceIndex: number) => {
    onAnswerChange(questionId, choiceIndex);
    
    // Auto-advance to next question after a short delay
    if (!isLastQuestion) {
      setTimeout(() => {
        onQuestionChange(currentQuestionIndex + 1);
      }, 800);
    }
  };

  const toggleCollapse = (questionId: string) => {
    setCollapsedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId); else next.add(questionId);
      return next;
    });
  };

  const getQuestionTypeIndicator = (index: number) => {
    const types = ['Begrip', 'Argumentatie', 'Structuur', 'Interpretatie', 'Evaluatie'];
    return types[index] || 'Vraag';
  };

  return (
    <div className="w-full h-full flex-shrink-0 min-w-0" data-testid="mcq-list">

      {/* Single Question Display */}
      {currentQuestion && (
        <div className="animate-fade-in w-full h-full min-w-0">
          <div className="w-full h-full flex flex-col min-w-0">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium text-white/80">Vraag {currentQuestionIndex + 1} van {questions.length}</span>
            </div>
            <h3 className="text-lg font-semibold text-white leading-snug mb-6">{currentQuestion.question}</h3>

            {/* Choices */}
            <div className="space-y-3 flex-1 min-w-0" data-testid={`question-choices-${currentQuestion.id}`}>
              {currentQuestion.choices.map((choice, choiceIndex) => {
                const isSelected = answers[currentQuestion.id] === choiceIndex;
                const choiceLetter = String.fromCharCode(65 + choiceIndex);
                return (
                  <button
                    key={choiceIndex}
                    onClick={() => handleAnswerSelect(currentQuestion.id, choiceIndex)}
                    className={`w-full text-left justify-start p-4 min-h-[60px] transition-all duration-200 border rounded-md focus:outline-none min-w-0 ${
                      isSelected
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-white/10 border-white/30 text-white hover:bg-white/20 hover:border-white/50'
                    }`}
                    data-testid={`choice-${currentQuestion.id}-${choiceIndex}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`${isSelected ? 'bg-purple-800 border-purple-800 text-white' : 'border-white/50 text-white'} shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold`}>
                        {choiceLetter}
                      </span>
                      <span className="text-sm leading-relaxed text-white break-words min-w-0 flex-1">{choice.replace(/^[A-D]\s*/, '')}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {allAnswered && (
        <div className="text-center p-6 bg-white/10 rounded-xl border border-white/20 text-white">
          <div className="text-white text-lg font-semibold mb-2">🎉 Alle vragen beantwoord!</div>
          <p className="text-white/90">Je hebt alle {questions.length} vragen beantwoord. Bekijk je resultaten hieronder.</p>
        </div>
      )}
    </div>
  );
}
