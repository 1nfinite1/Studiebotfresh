// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { LEZEN_ALL_TOPICS } from '../../../lib/types/lezen';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
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

  // Create playful rows with 3-5 topics each
  const createPlayfulRows = () => {
    const topics = [...LEZEN_ALL_TOPICS];
    const rows = [];
    let currentIndex = 0;

    // Define row sizes to create variety
    const rowSizes = [4, 3, 5, 4, 4]; // This gives us 20 topics total

    rowSizes.forEach((size, rowIndex) => {
      const rowTopics = topics.slice(currentIndex, currentIndex + size);
      rows.push({
        topics: rowTopics,
        size,
        offset: rowIndex % 2 === 0 ? 'ml-0' : 'ml-8' // Alternate offset for playful look
      });
      currentIndex += size;
    });

    return rows;
  };

  const topicRows = createPlayfulRows();

  return (
    <div className="h-screen flex items-center justify-center relative overflow-hidden">
      {/* Main container with 70% height */}
      <div className="w-full h-[70vh] flex relative">
        
        {/* Vertical white line in the middle */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/80 transform -translate-x-0.5 z-10 shadow-lg"></div>
        
        {/* Left side - Topics */}
        <div className="w-1/2 pr-12 flex flex-col justify-center">
          <div className="space-y-6">
            {/* Header for left side */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-2">
                <BookOpen className="h-5 w-5 text-amber-400" />
                <h2 className="text-xl font-bold text-white">Populaire onderwerpen</h2>
              </div>
            </div>

            {/* Playful topic rows */}
            <div className="space-y-4">
              {topicRows.map((row, rowIndex) => (
                <div key={rowIndex} className={`flex gap-3 justify-start ${row.offset}`}>
                  {row.topics.map((topic) => (
                    <Button
                      key={topic}
                      onClick={() => onTopicSelect(topic)}
                      disabled={isGenerating}
                      className="
                        px-4 py-2.5 rounded-full text-sm font-medium whitespace-nowrap
                        bg-white/15 backdrop-blur-md border border-white/40
                        text-white hover:bg-white/25 hover:scale-105 hover:shadow-lg
                        transition-all duration-300 shadow-md
                        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                      "
                      data-testid={`topic-button-${topic.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {topic}
                    </Button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right side - Custom input */}
        <div className="w-1/2 pl-12 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center h-full space-y-8">
            {/* Custom topic section */}
            <div className="text-center space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4 justify-center">
                  <label className="text-white font-semibold text-lg whitespace-nowrap">
                    Kies je eigen onderwerp
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/70" />
                    <Input
                      type="text"
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      placeholder="Bijv. Ruimtevaart"
                      disabled={isGenerating}
                      className="
                        pl-10 pr-4 py-3 w-64 rounded-full
                        bg-white/15 backdrop-blur-md border border-white/40
                        text-white placeholder:text-white/70
                        focus:bg-white/25 focus:ring-2 focus:ring-white/60 focus:border-white/60
                        transition-all duration-300 shadow-md
                      "
                      data-testid="custom-topic-input"
                      onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit(e)}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleCustomSubmit}
                  disabled={isGenerating || !customTopic.trim()}
                  className="
                    px-8 py-3.5 rounded-full font-semibold text-lg
                    bg-white text-purple-700 hover:bg-white/95 hover:scale-105
                    transition-all duration-300 shadow-lg
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                  "
                  data-testid="generate-custom-topic-btn"
                >
                  {isGenerating ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Tekst genereren...</span>
                    </div>
                  ) : (
                    'Tekst genereren'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading indicator when generating */}
      {isGenerating && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="text-center text-white/90 animate-pulse">
            <div className="inline-flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span className="font-medium">Bezig met het maken van jouw artikel en vragen...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}