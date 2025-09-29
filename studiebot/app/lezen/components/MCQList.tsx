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
}

export function MCQList({ questions, answers, onAnswerChange, onAllAnswered }: MCQListProps) {
  const [collapsedQuestions, setCollapsedQuestions] = useState<Set<string>>(new Set());

  const allAnswered = questions.every(q => answers[q.id] !== undefined);
  const answeredCount = Object.keys(answers).length;

  React.useEffect(() => {
    if (allAnswered && onAllAnswered) onAllAnswered();
  }, [allAnswered, onAllAnswered]);

  const handleAnswerSelect = (questionId: string, choiceIndex: number) => {
    onAnswerChange(questionId, choiceIndex);
    setTimeout(() => {
      setCollapsedQuestions(prev => new Set(prev).add(questionId));
    }, 200);
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
    <div className="space-y-4" data-testid="mcq-list">
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

      {questions.map((question, index) => {
        const isAnswered = answers[question.id] !== undefined;
        const isCollapsed = collapsedQuestions.has(question.id);
        const selectedChoice = answers[question.id];

        return (
          <Card 
            key={question.id}
            className={`transition-all duration-300 backdrop-blur-sm ${
              isAnswered 
                ? 'bg-white/5 border-white/20 text-white shadow-sm' 
                : 'bg-white/10 border-white/20 text-white shadow-sm hover:bg-white/15'
            }`}
            data-testid={`question-card-${question.id}`}
          >
            <CardContent className="p-0">
              {isAnswered && isCollapsed ? (
                <div 
                  className="h-12 px-4 flex items-center justify-between cursor-pointer hover:bg-white/10"
                  onClick={() => toggleCollapse(question.id)}
                  data-testid={`question-header-${question.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-200/90 text-green-900">{getQuestionTypeIndicator(index)}</span>
                    <span className="text-sm text-white/90 font-medium shrink-0">Vraag {index + 1}</span>
                    <span className="text-sm text-white/70 truncate">
                      • Antwoord: <span className="font-semibold text-white">{String.fromCharCode(65 + selectedChoice)}</span>
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-white/80" />
                </div>
              ) : (
                <div 
                  className={`p-4 cursor-pointer transition-colors ${isAnswered ? 'bg-white/5' : 'hover:bg-white/10'}`}
                  onClick={() => isAnswered ? toggleCollapse(question.id) : undefined}
                  data-testid={`question-header-${question.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          isAnswered ? 'bg-green-200 text-green-800' : 'bg-white/30 text-white'
                        }`}>
                          {getQuestionTypeIndicator(index)}
                        </span>
                        <span className="text-sm font-medium text-white/80">
                          Vraag {index + 1}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-white leading-snug">
                        {question.question}
                      </h3>
                    </div>
                    {isAnswered && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="shrink-0 text-white/80 hover:text-white"
                        data-testid={`toggle-question-${question.id}`}
                        onClick={() => toggleCollapse(question.id)}
                      >
                        {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Choices - black text on white background for readability */}
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
                        className={`w-full text-left justify-start p-4 h-auto transition-all duration-200 border rounded-md ${
                          isSelected
                            ? 'bg-green-50 border-green-300 text-green-800'
                            : isAnswered
                            ? 'bg-white border-gray-200 text-gray-800 opacity-80'
                            : 'bg-white border-gray-200 text-gray-900 hover:bg-purple-50 hover:border-purple-300'
                        }`}
                        data-testid={`choice-${question.id}-${choiceIndex}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                            isSelected
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-gray-300 text-gray-700'
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

      {allAnswered && (
        <div className="text-center p-6 bg-white/10 rounded-xl border border-white/20 text-white">
          <div className="text-white text-lg font-semibold mb-2">
            🎉 Alle vragen beantwoord!
          </div>
          <p className="text-white/90">
            Je hebt alle {questions.length} vragen beantwoord. Bekijk je resultaten hieronder.
          </p>
        </div>
      )}
    </div>
  );
}
