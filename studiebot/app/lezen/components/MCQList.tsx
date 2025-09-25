'use client';

import React, { useState, useRef, useEffect } from 'react';
import { LezenQuestion, LezenAnswerState } from '../../../lib/types/lezen';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';

// Type assertion for JSX components
const TypedCard = Card as any;
const TypedCardContent = CardContent as any;
const TypedButton = Button as any;
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

interface MCQListProps {
  questions: LezenQuestion[];
  answers: LezenAnswerState;
  onAnswerChange: (questionId: string, choiceIndex: number) => void;
  onAllAnswered?: () => void;
}

export function MCQList({ questions, answers, onAnswerChange, onAllAnswered }: MCQListProps) {
  const [collapsedQuestions, setCollapsedQuestions] = useState<Set<string>>(new Set());
  const questionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Check if all questions are answered
  const allAnswered = questions.every(q => answers[q.id] !== undefined);
  const answeredCount = Object.keys(answers).length;

  // Auto-focus next question when one is answered
  useEffect(() => {
    if (answeredCount > 0 && answeredCount < questions.length) {
      const nextUnanswered = questions.find(q => answers[q.id] === undefined);
      if (nextUnanswered && questionRefs.current[nextUnanswered.id]) {
        setTimeout(() => {
          questionRefs.current[nextUnanswered.id]?.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }, 300);
      }
    } else if (allAnswered && onAllAnswered) {
      onAllAnswered();
    }
  }, [answeredCount, allAnswered, questions, answers, onAllAnswered]);

  const handleAnswerSelect = (questionId: string, choiceIndex: number) => {
    onAnswerChange(questionId, choiceIndex);
    
    // Collapse the question after answering
    setTimeout(() => {
      setCollapsedQuestions(prev => new Set(prev).add(questionId));
    }, 500);
  };

  const toggleCollapse = (questionId: string) => {
    setCollapsedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const getQuestionTypeIndicator = (index: number) => {
    const types = ['Begrip', 'Argumentatie', 'Structuur', 'Interpretatie', 'Evaluatie'];
    return types[index] || 'Vraag';
  };

  return (
    <div className="space-y-4" data-testid="mcq-list">
      {/* Progress Header */}
      <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm ring-1 ring-white/20">
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-purple-200" />
            <span className="font-semibold">Vragen beantwoorden</span>
          </div>
          <span className="text-sm bg-white/20 rounded-full px-3 py-1">
            {answeredCount} van {questions.length}
          </span>
        </div>
        <div className="mt-2 bg-white/20 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Questions */}
      {questions.map((question, index) => {
        const isAnswered = answers[question.id] !== undefined;
        const isCollapsed = collapsedQuestions.has(question.id);
        const selectedChoice = answers[question.id];

        return (
          <TypedCard 
            key={question.id}
            ref={el => questionRefs.current[question.id] = el}
            className={`transition-all duration-300 ${
              isAnswered 
                ? 'bg-green-50 border-green-200 shadow-md' 
                : 'bg-white border-purple-200 shadow-sm hover:shadow-md'
            }`}
            data-testid={`question-card-${question.id}`}
          >
            <TypedCardContent className="p-0">
              {/* Question Header - Always Visible */}
              <div 
                className={`p-4 cursor-pointer transition-colors ${
                  isAnswered ? 'bg-green-100/50' : 'hover:bg-purple-50'
                }`}
                onClick={() => isAnswered ? toggleCollapse(question.id) : undefined}
                data-testid={`question-header-${question.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        isAnswered 
                          ? 'bg-green-200 text-green-800' 
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {getQuestionTypeIndicator(index)}
                      </span>
                      <span className="text-sm font-medium text-gray-600">
                        Vraag {index + 1}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-purple-900 leading-snug">
                      {question.question}
                    </h3>
                    {isAnswered && isCollapsed && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm text-gray-600">Antwoord:</span>
                        <span className="font-medium text-green-700">
                          {String.fromCharCode(65 + selectedChoice)}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {isAnswered && (
                    <TypedButton 
                      variant="ghost" 
                      size="sm"
                      className="shrink-0 text-gray-500 hover:text-gray-700"
                      data-testid={`toggle-question-${question.id}`}
                    >
                      {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>

              {/* Question Content - Collapsible */}
              {(!isAnswered || !isCollapsed) && (
                <div className="px-4 pb-4 space-y-3" data-testid={`question-choices-${question.id}`}>
                  {question.choices.map((choice, choiceIndex) => {
                    const isSelected = selectedChoice === choiceIndex;
                    const choiceLetter = String.fromCharCode(65 + choiceIndex);
                    
                    return (
                      <Button
                        key={choiceIndex}
                        onClick={() => handleAnswerSelect(question.id, choiceIndex)}
                        disabled={isAnswered}
                        variant="outline"
                        className={`w-full text-left justify-start p-4 h-auto transition-all duration-200 ${
                          isSelected
                            ? 'bg-green-100 border-green-300 text-green-800 shadow-sm'
                            : isAnswered
                            ? 'opacity-60 cursor-not-allowed'
                            : 'hover:bg-purple-50 hover:border-purple-300 border-gray-200'
                        }`}
                        data-testid={`choice-${question.id}-${choiceIndex}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                            isSelected
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-gray-300 text-gray-600'
                          }`}>
                            {choiceLetter}
                          </span>
                          <span className="text-sm leading-relaxed">
                            {choice.replace(/^[A-D]\s*/, '')}
                          </span>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Completion Message */}
      {allAnswered && (
        <div className="text-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
          <div className="text-green-700 text-lg font-semibold mb-2">
            🎉 Alle vragen beantwoord!
          </div>
          <p className="text-green-600">
            Je hebt alle {questions.length} vragen beantwoord. Bekijk je resultaten hieronder.
          </p>
        </div>
      )}
    </div>
  );
}