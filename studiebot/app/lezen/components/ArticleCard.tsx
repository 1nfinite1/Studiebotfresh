// @ts-nocheck
'use client';

import React from 'react';
import { LezenArticle } from '../../../lib/types/lezen';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';

export function ArticleCard({ article }: ArticleCardProps) {
  // Calculate estimated reading time (Dutch average: ~200 words per minute)
  const totalWords = article.paragraphs.join(' ').split(/\s+/).filter(word => word.length > 0).length;
  const readingTime = Math.ceil(totalWords / 200);

  return (
    <Card className="bg-white shadow-lg border-0 overflow-hidden" data-testid="article-card">
      <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-200" />
            <CardTitle className="text-xl font-bold leading-tight" data-testid="article-title">
              {article.title}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1 text-sm font-medium shrink-0">
            <Clock className="h-4 w-4" />
            <span>{readingTime} min</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-4" data-testid="article-content">
        {article.paragraphs.map((paragraph, index) => (
          <p 
            key={index} 
            className="text-purple-900 leading-relaxed text-base"
            data-testid={`article-paragraph-${index + 1}`}
          >
            {paragraph}
          </p>
        ))}
        
        {/* Reading progress indicator */}
        <div className="mt-6 pt-4 border-t border-purple-100">
          <div className="flex items-center gap-2 text-sm text-purple-600">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="font-medium">
              Artikel gelezen • {totalWords} woorden • HAVO2 niveau
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}