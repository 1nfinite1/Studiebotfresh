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

  const createPlayfulRows = () => {
    const topics = [...LEZEN_ALL_TOPICS];
    const rows: { topics: string[] }[] = [];
    let currentIndex = 0;
    const sizes = [4, 3, 5, 4, 4];
    sizes.forEach((size) => {
      const rowTopics = topics.slice(currentIndex, currentIndex + size);
      if (rowTopics.length) rows.push({ topics: rowTopics });
      currentIndex += size;
    });
    return rows;
  };

  const topicRows = createPlayfulRows();

  return (
    // Ana container - içeriği ortalamak için justify-start yerine justify-center
    <div className="w-full h-screen flex flex-col items-center justify-center pt-2 pb-8">
      <div className="w-full max-w-6xl mx-auto px-6">
        
        {/* Üst blok - Topics */}
        <div 
          className="text-center" 
          style={{ marginBottom: '60px !important' }}
        >
          <div className="space-y-6 w-full max-w-4xl mx-auto">
            <div className="text-center mb-8" style={{ marginTop: '40px !important' }}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <BookOpen className="h-5 w-5 text-amber-400" />
                <h2 className="text-xl font-bold text-white">Populaire onderwerpen</h2>
              </div>
            </div>
            <div className="space-y-4">
              {topicRows.map((row, rowIndex) => (
                <div key={rowIndex} className="flex gap-3 flex-wrap justify-center">
                  {row.topics.map((topic) => (
                    <Button
                      key={topic}
                      onClick={() => onTopicSelect(topic)}
                      disabled={isGenerating}
                      className="px-4 py-2.5 rounded-full text-sm font-medium whitespace-nowrap bg-white/15 backdrop-blur-md border border-white/40 text-white hover:bg-white/25 hover:scale-105 hover:shadow-lg transition-all duration-300 shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 hover:text-gray-300"
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

        {/* Horizontal divider - Gri çizgi bar */}
        <div 
          className="flex justify-center items-center w-full"
          style={{ margin: '60px 0 !important' }}
        >
          <div
            className="rounded-full"
            style={{ 
              width: '70vw', 
              height: '2px',
              backgroundColor: 'rgb(255 255 255 / 0.6)',
            }}
          ></div>
        </div>

        {/* Alt blok - Custom input */}
        <div className="text-center">
          <div className="space-y-8 w-full max-w-2xl mx-auto">
            <div className="space-y-8">
              {/* Başlık ve search bar aynı satırda */}
              <div className="flex items-center justify-center gap-4">
                <label className="text-white font-semibold text-lg whitespace-nowrap">Kies je eigen onderwerp</label>
                <div className="relative" style={{ width: '500px' }}>
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/70" />
                  <Input
                    type="text"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder="bijv. Ruimtevaart"
                    disabled={isGenerating}
                    className="pl-8 pr-4 py-3 w-full rounded-full bg-white/15 backdrop-blur-md 
                               border border-white/40 text-white placeholder:text-white/60 
                               focus:bg-white/25 focus:ring-2 focus:ring-white/60 
                               focus:border-white/60 transition-all duration-300 shadow-md"
                    data-testid="custom-topic-input"
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit(e)}
                  />
                </div>
              </div>

              {/* Tekst genereren butonu - MARGIN ile ayrılmış */}
              <div 
                className="flex justify-center"
                style={{ marginTop: '40px !important' }}
              >
                <Button
                  onClick={handleCustomSubmit}
                  disabled={isGenerating || !customTopic.trim()}
                  className="px-8 py-3.5 rounded-full font-semibold text-lg bg-white text-purple-700 hover:bg-white/95 hover:scale-105 transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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

      {isGenerating && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-10">
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
