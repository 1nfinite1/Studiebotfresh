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
          <div className="mb-4 p-4 bg-red-100 border border-red-300 rounded-lg text-red-800" data-testid="error-message">
            <p className="font-medium">Er ging iets mis:</p>
            <p>{error}</p>
            <Button onClick={() => setError('')} variant="outline" size="sm" className="mt-2 border-red-300 text-red-800 hover:bg-red-50">Probeer opnieuw</Button>
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
          <div className="min-h-[70vh] w-full flex relative">
            {/* Left half - Article */}
            <div className="w-1/2 flex flex-col justify-start p-6 overflow-y-auto">
              <div className="space-y-6">
                <div className="text-center text-white mb-2">
                  <h2 className="text-xl font-semibold mb-1">Onderwerp: {selectedTopic}</h2>
                  <p className="text-white/90">Lees eerst de tekst, beantwoord daarna de vragen</p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                  <div className="space-y-4">
                    <h1 className="text-2xl font-bold text-white mb-4" data-testid="article-title">{generatedContent.article.title}</h1>
                    <div className="space-y-4" data-testid="article-content">
                      {generatedContent.article.paragraphs.map((paragraph, index) => (
                        <p key={index} className="text-white leading-relaxed text-base" data-testid={`article-paragraph-${index + 1}`}>{paragraph}</p>
                      ))}
                    </div>
                    <div className="mt-6 pt-4 border-t border-white/20">
                      <div className="flex items-center gap-2 text-sm text-white/80">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span className="font-medium">HAVO2 niveau • {generatedContent.article.paragraphs.join(' ').split(/\s+/).length} woorden</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Vertical white line in the middle */}
            <div className="self-stretch w-[2px] bg-white opacity-80 rounded-full shadow-2xl" />

            {/* Right half - Questions */}
            <div className="w-1/2 flex flex-col justify-start p-6 overflow-y-auto">
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white mb-2 text-center">Vragen bij de tekst</h3>
                <MCQList questions={generatedContent.questions} answers={answers} onAnswerChange={handleAnswerChange} onAllAnswered={handleAllAnswered} />
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
