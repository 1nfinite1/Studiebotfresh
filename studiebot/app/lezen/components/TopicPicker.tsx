'use client';

import React, { useState } from 'react';
import { LEZEN_ALL_TOPICS } from '../../../lib/types/lezen';
import { Button } from '../../../components/ui/button.jsx';
import { Input } from '../../../components/ui/input.jsx';
import { Search, BookOpen } from 'lucide-react';

interface TopicPickerProps {
  onTopicSelect: (topic: string) => void;
  isGenerating: boolean;
}

export function TopicPicker({ onTopicSelect, isGenerating }: TopicPickerProps) {
  const [customTopic, setCustomTopic] = useState('');

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customTopic.trim()) {
      onTopicSelect(customTopic.trim());
      setCustomTopic('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-4">
          <BookOpen className="h-6 w-6 text-amber-400" />
          <h2 className="text-2xl font-bold text-white">Kies een onderwerp</h2>
        </div>
        <p className="text-white/90 text-lg">
          Selecteer een onderwerp of voer je eigen onderwerp in
        </p>
      </div>

      {/* Topic Grid */}
      <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm ring-1 ring-white/20">
        <h3 className="text-white font-semibold mb-4 text-center">Populaire onderwerpen</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {LEZEN_ALL_TOPICS.map((topic) => (
            <Button
              key={topic}
              onClick={() => onTopicSelect(topic)}
              disabled={isGenerating}
              variant="outline"
              className="h-auto py-3 px-4 bg-white/90 hover:bg-white hover:scale-105 text-purple-800 border-white/30 transition-all duration-200 font-medium"
              data-testid={`topic-button-${topic.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {topic}
            </Button>
          ))}
        </div>
      </div>

      {/* Custom Topic Input */}
      <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm ring-1 ring-white/20">
        <h3 className="text-white font-semibold mb-4 text-center">Of voer je eigen onderwerp in</h3>
        <form onSubmit={handleCustomSubmit} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-purple-400" />
            <Input
              type="text"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="Bijv. De Nederlandse Gouden Eeuw"
              disabled={isGenerating}
              className="pl-10 h-12 text-lg bg-white/90 border-white/30 text-purple-800 placeholder:text-purple-400 focus:ring-2 focus:ring-purple-300 focus:border-transparent"
              data-testid="custom-topic-input"
            />
          </div>
          <Button
            type="submit"
            disabled={isGenerating || !customTopic.trim()}
            className="w-full h-12 bg-white text-purple-700 hover:bg-purple-50 font-semibold text-lg transition-colors disabled:opacity-50"
            data-testid="generate-custom-topic-btn"
          >
            {isGenerating ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Tekst genereren...</span>
              </div>
            ) : (
              'Genereer tekst'
            )}
          </Button>
        </form>
      </div>

      {isGenerating && (
        <div className="text-center text-white/90 animate-pulse">
          <div className="inline-flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Bezig met het maken van jouw artikel en vragen...</span>
          </div>
        </div>
      )}
    </div>
  );
}