// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { LezenGenerateResponse, LezenAnswerState } from '../../lib/types/lezen';
import { TopicPicker } from './components/TopicPicker';
import { MCQList } from './components/MCQList';
import { ResultSummary } from './components/ResultSummary';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import Link from 'next/link';

type SessionPhase = 'topic-selection' | 'reading-questions' | 'results';

export default function LezenPage() {
  const [phase, setPhase] = useState<SessionPhase>('topic-selection');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<LezenGenerateResponse | null>(null);
  const [answers, setAnswers] = useState<LezenAnswerState>({});
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const generateContent = async (topic: string) => {
    setIsGenerating(true);
    setError('');
    setSelectedTopic(topic);

    try {
      const response = await fetch('/api/llm/lezen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, level: 'havo2' }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Failed to generate content');

      setGeneratedContent(data);
      setPhase('reading-questions');
      setAnswers({});
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Er ging iets mis bij het genereren van de tekst. Probeer het opnieuw.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswerChange = (questionId: string, choiceIndex: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: choiceIndex }));
  };

  const handleAllAnswered = () => {
    setTimeout(() => setPhase('results'), 800);
  };

  const resetSession = () => {
    setPhase('topic-selection');
    setGeneratedContent(null);
    setAnswers({});
    setSelectedTopic('');
    setError('');
    setCurrentQuestionIndex(0);
  };

  const handleQuestionChange = (index: number) => {
    setCurrentQuestionIndex(index);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-700 via-purple-600 to-fuchsia-600">
      {/* Header (container) */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-white hover:text-white/80 transition-colors" data-testid="home-link">
              <Home className="h-5 w-5" />
              <span className="font-semibold">Studiebot</span>
            </Link>
            <span className="text-white/60">•</span>
            <h1 className="text-2xl font-bold text-white">Lezen</h1>
          </div>

          {phase !== 'topic-selection' && (
            <Button onClick={resetSession} variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20" data-testid="back-to-topics-btn">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Terug naar onderwerpen
            </Button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-6 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl text-white" data-testid="error-message">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-pink-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-pink-400 text-sm">⚠</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-white mb-2">Er ging iets mis:</p>
                <p className="text-white/90 mb-4 leading-relaxed">{error}</p>
                <button 
                  onClick={() => setError('')} 
                  className="px-3 py-1.5 text-xs border border-white/40 rounded-full text-white bg-white/15 backdrop-blur-md hover:bg-white/25 transition-all duration-300 shadow-md"
                >
                  Probeer opnieuw
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Full-bleed Topic Picker (outside container) */}
      {phase === 'topic-selection' && (
        <TopicPicker onTopicSelect={generateContent} isGenerating={isGenerating} />
      )}

      {/* Reading & Questions (container) */}
      {phase === 'reading-questions' && generatedContent && (
        <div className="container mx-auto px-4 pb-8" data-testid="reading-questions-section">
          {/* BIG MAIN CONTAINER - DYNAMIC HEIGHT */}
          <div className="w-full max-w-7xl mx-auto bg-white/5 backdrop-blur-sm rounded-2xl border border-white/20 p-6 min-h-[600px] flex flex-col relative">
            {/* Header and Progress Indicator - JUSTIFY BETWEEN */}
            <div className="flex justify-between items-center text-white mb-4">
              {/* Header - LEFT SIDE */}
              <div className="text-left">
                <h2 className="text-xl font-semibold mb-2">Onderwerp: {selectedTopic}</h2>
                <p className="text-white/90">Lees eerst de tekst, beantwoord daarna de vragen</p>
              </div>
              
              {/* Progress Indicator - RIGHT SIDE */}
              <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm ring-1 ring-white/20 w-fit ">
                <div className="flex items-center justify-between text-white mb-3">
                  <span className="text-sm font-medium">Quiz Voortgang</span>
                </div>
                <div className="flex justify-center space-x-2">
                  {generatedContent.questions.map((_, index) => {
                    const isCurrent = index === currentQuestionIndex;
                    return (
                      <button
                        key={index}
                        onClick={() => handleQuestionChange(index)}
                        className={`w-8 h-8 rounded-full transition-all duration-300 flex items-center justify-center text-xs font-bold ${
                          isCurrent
                            ? 'bg-purple-300 text-white'
                            : 'bg-white/20 text-white/70 hover:bg-white/30'
                        }`}
                        data-testid={`progress-step-${index}`}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Left and Right blocks container - RESPONSIVE LAYOUT */}
            <div className="flex flex-col lg:flex-row gap-6 flex-1">
              {/* Left side - Article */}
              <div className="flex-1 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/20 min-h-[400px] max-h-[500px] overflow-y-auto">
                <div className="space-y-4">
                  <h1 className="text-2xl font-bold text-white mb-4" data-testid="article-title">{generatedContent.article.title}</h1>
                  <div className="space-y-4" data-testid="article-content">
                    {generatedContent.article.paragraphs.map((paragraph, index) => (
                      <p key={index} className="text-white leading-relaxed text-base" data-testid={`article-paragraph-${index + 1}`}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right side - Questions */}
              <div className="flex-1 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/20 min-h-[400px] max-h-[600px] flex flex-col">
                <h3 className="text-xl font-bold text-white mb-4 text-center">Vragen bij de tekst</h3>
                <div className="flex-1 overflow-y-auto overflow-x-visible">
                  <MCQList 
                    questions={generatedContent.questions} 
                    answers={answers} 
                    onAnswerChange={handleAnswerChange} 
                    onAllAnswered={handleAllAnswered}
                    currentQuestionIndex={currentQuestionIndex}
                    onQuestionChange={handleQuestionChange}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === 'results' && generatedContent && (
        <div className="container mx-auto px-4 pb-10" data-testid="results-section">
          <div className="text-center text-white mb-6">
            <h2 className="text-xl font-semibold mb-2">Resultaten voor: {selectedTopic}</h2>
            <p className="text-white/90">Bekijk hoe je het hebt gedaan</p>
          </div>
          <ResultSummary questions={generatedContent.questions} answers={answers} onNewSession={resetSession} />
        </div>
      )}
    </div>
  );
}
