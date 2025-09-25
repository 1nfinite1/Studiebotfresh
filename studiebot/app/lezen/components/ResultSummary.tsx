// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { LezenQuestion, LezenAnswerState } from '../../../lib/types/lezen';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { CheckCircle, XCircle, ChevronDown, ChevronUp, Trophy, Target, BookOpen } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../components/ui/collapsible';

interface ResultSummaryProps {
  questions: LezenQuestion[];
  answers: LezenAnswerState;
  onNewSession: () => void;
}

export function ResultSummary({ questions, answers, onNewSession }: ResultSummaryProps) {
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set());

  const results = questions.map(question => {
    const userAnswerIndex = answers[question.id];
    const isCorrect = userAnswerIndex === question.correctIndex;
    const userAnswerLetter = userAnswerIndex !== undefined ? String.fromCharCode(65 + userAnswerIndex) : '?';
    const correctAnswerLetter = String.fromCharCode(65 + question.correctIndex);
    
    return {
      question,
      userAnswerIndex,
      userAnswerLetter,
      correctAnswerLetter,
      isCorrect,
      emoji: isCorrect ? '✅' : '❌'
    };
  });

  const correctCount = results.filter(r => r.isCorrect).length;
  const totalCount = questions.length;
  const percentage = Math.round((correctCount / totalCount) * 100);
  const grade = (percentage / 10).toFixed(1);

  const toggleQuestion = (questionId: string) => {
    setOpenQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const getPerformanceMessage = (percentage: number) => {
    if (percentage >= 90) return "Uitstekend! Je begrijpt de tekst heel goed.";
    if (percentage >= 70) return "Goed gedaan! Je hebt de belangrijkste punten begrepen.";
    if (percentage >= 50) return "Redelijk resultaat. Er zijn nog enkele punten om te verbeteren.";
    return "Probeer de tekst nog eens goed door te lezen en let op de details.";
  };

  return (
    <div className="space-y-6" data-testid="results-summary">
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 shadow-lg">
        <CardHeader className="text-center pb-3">
          <div className="flex items-center justify-center mb-2">
            <Trophy className="h-8 w-8 text-yellow-500 mr-2" />
            <CardTitle className="text-2xl font-bold text-purple-900">
              Jouw Resultaat
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <div className={`text-4xl font-bold ${getScoreColor(percentage)}`}>
                {correctCount}/{totalCount}
              </div>
              <div className="text-sm text-purple-600 font-medium">Correct</div>
            </div>
            <div className="text-center">
              <div className={`text-4xl font-bold ${getScoreColor(percentage)}`}>
                {percentage}%
              </div>
              <div className="text-sm text-purple-600 font-medium">Score</div>
            </div>
            <div className="text-center">
              <div className={`text-4xl font-bold ${getScoreColor(percentage)}`}>
                {grade}
              </div>
              <div className="text-sm text-purple-600 font-medium">Cijfer</div>
            </div>
          </div>
          
          <div className="bg-white/60 rounded-lg p-4 mx-4">
            <p className="text-purple-800 font-medium">
              {getPerformanceMessage(percentage)}
            </p>
          </div>

          <Button
            onClick={onNewSession}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-8 py-2 transition-colors"
            data-testid="new-session-btn"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Nieuwe tekst en vragen
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Target className="h-5 w-5 text-purple-600" />
            Uitgebreide feedback per vraag
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {results.map((result, index) => (
            <Collapsible
              key={result.question.id}
              open={openQuestions.has(result.question.id)}
              onOpenChange={() => toggleQuestion(result.question.id)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between p-4 h-auto hover:bg-purple-50 border-purple-200"
                  data-testid={`result-question-${result.question.id}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {result.emoji}
                    </span>
                    <div className="text-left">
                      <div className="font-semibold text-purple-900">
                        Vraag {index + 1}
                      </div>
                      <div className="text-sm text-purple-600">
                        Jouw antwoord: {result.userAnswerLetter} • 
                        Correct antwoord: {result.correctAnswerLetter}
                      </div>
                    </div>
                  </div>
                  {openQuestions.has(result.question.id) ? 
                    <ChevronUp className="h-4 w-4 text-purple-600" /> : 
                    <ChevronDown className="h-4 w-4 text-purple-600" />
                  }
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="px-4 pb-4 pt-2">
                <div className="space-y-4 border-l-4 border-purple-200 pl-4 ml-2">
                  <div>
                    <h4 className="font-semibold text-purple-900 mb-2">Vraag:</h4>
                    <p className="text-purple-800">{result.question.question}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-purple-900 mb-2">Jouw antwoord:</h4>
                    <div className={`p-3 rounded-lg ${
                      result.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      <div className="flex items-center gap-2">
                        {result.isCorrect ? 
                          <CheckCircle className="h-4 w-4" /> : 
                          <XCircle className="h-4 w-4" />
                        }
                        <span className="font-medium">{result.userAnswerLetter}:</span>
                        <span>{result.question.choices[result.userAnswerIndex]?.replace(/^[A-D]\s*/, '') || 'Geen antwoord'}</span>
                      </div>
                    </div>
                  </div>

                  {!result.isCorrect && (
                    <div>
                      <h4 className="font-semibold text-purple-900 mb-2">Correct antwoord:</h4>
                      <div className="p-3 rounded-lg bg-green-100 text-green-800">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          <span className="font-medium">{result.correctAnswerLetter}:</span>
                          <span>{result.question.choices[result.question.correctIndex]?.replace(/^[A-D]\s*/, '')}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold text-purple-900 mb-2">Uitleg:</h4>
                    <div className="p-3 rounded-lg bg-blue-50 text-blue-800">
                      <p>{result.question.explanation}</p>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}