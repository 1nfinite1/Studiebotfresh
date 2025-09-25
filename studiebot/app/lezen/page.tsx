'use client';

import React, { useState } from 'react';
import { LezenGenerateResponse, LezenAnswerState } from '../../lib/types/lezen';
import { TopicPicker } from './components/TopicPicker';
import { ArticleCard } from './components/ArticleCard';
import { MCQList } from './components/MCQList';
import { ResultSummary } from './components/ResultSummary';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type SessionPhase = 'topic-selection' | 'reading-questions' | 'results';

export default function LezenPage() {
  const router = useRouter();
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: topic,
          level: 'havo2'
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'Failed to generate content');
      }

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
    setAnswers(prev => ({
      ...prev,
      [questionId]: choiceIndex
    }));
  };

  const handleAllAnswered = () => {
    // Small delay to let the last answer animation complete
    setTimeout(() => {
      setPhase('results');
    }, 1000);
  };

  const startNewSession = () => {
    setPhase('topic-selection');
    setGeneratedContent(null);
    setAnswers({});
    setSelectedTopic('');
    setError('');
  };

  const goBackToTopicSelection = () => {
    setPhase('topic-selection');
    setGeneratedContent(null);
    setAnswers({});
    setSelectedTopic('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-700 via-purple-600 to-fuchsia-600">
      {/* Header */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="flex items-center gap-2 text-white hover:text-white/80 transition-colors"
              data-testid="home-link"
            >
              <Home className="h-5 w-5" />
              <span className="font-semibold">Studiebot</span>
            </Link>
            <span className="text-white/60">•</span>
            <h1 className="text-2xl font-bold text-white">Lezen</h1>
          </div>

          {phase !== 'topic-selection' && (
            <Button
              onClick={goBackToTopicSelection}
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              data-testid="back-to-topics-btn"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Terug naar onderwerpen
            </Button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg text-red-800" data-testid="error-message">
            <p className="font-medium">Er ging iets mis:</p>
            <p>{error}</p>
            <Button
              onClick={() => setError('')}
              variant="outline"
              size="sm"
              className="mt-2 border-red-300 text-red-800 hover:bg-red-50"
            >
              Probeer opnieuw
            </Button>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {phase === 'topic-selection' && (
            <TopicPicker
              onTopicSelect={generateContent}
              isGenerating={isGenerating}
            />
          )}

          {phase === 'reading-questions' && generatedContent && (
            <div className="space-y-8" data-testid="reading-questions-section">
              {/* Topic Header */}
              <div className="text-center text-white mb-6">
                <h2 className="text-xl font-semibold mb-2">Onderwerp: {selectedTopic}</h2>
                <p className="text-white/90">Lees eerst de tekst, beantwoord daarna de vragen</p>
              </div>

              {/* Article */}
              <ArticleCard article={generatedContent.article} />

              {/* Questions */}
              <div>
                <h3 className="text-xl font-bold text-white mb-4 text-center">
                  Vragen bij de tekst
                </h3>
                <MCQList
                  questions={generatedContent.questions}
                  answers={answers}
                  onAnswerChange={handleAnswerChange}
                  onAllAnswered={handleAllAnswered}
                />
              </div>
            </div>
          )}

          {phase === 'results' && generatedContent && (
            <div className="space-y-6" data-testid="results-section">
              {/* Topic Header */}
              <div className="text-center text-white mb-6">
                <h2 className="text-xl font-semibold mb-2">Resultaten voor: {selectedTopic}</h2>
                <p className="text-white/90">Bekijk hoe je het hebt gedaan</p>
              </div>

              <ResultSummary
                questions={generatedContent.questions}
                answers={answers}
                onNewSession={startNewSession}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}