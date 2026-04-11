import { NextRequest, NextResponse } from 'next/server';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { query, sector } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Zoekterm is verplicht' },
        { status: 400 }
      );
    }

    if (!TAVILY_API_KEY || TAVILY_API_KEY === 'your_tavily_api_key_here') {
      return NextResponse.json(
        { error: 'Tavily API key niet geconfigureerd' },
        { status: 500 }
      );
    }

    // Bouw de zoekquery
    const searchQuery = sector 
      ? `${query} ${sector} nieuws trends`
      : `${query} nieuws trends`;

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query: searchQuery,
        search_depth: 'advanced',
        include_answer: true,
        max_results: 10,
        topic: 'news',
        days: 7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('Tavily API error:', response.status, errText.slice(0, 300));
      return NextResponse.json(
        { error: 'Kon geen nieuws ophalen', results: [], answer: '' },
        { status: 200 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      results: data.results || [],
      answer: data.answer || '',
    });
  } catch (error) {
    console.error('News fetch error:', error);
    return NextResponse.json(
      { error: 'Er is een fout opgetreden bij het ophalen van nieuws' },
      { status: 500 }
    );
  }
}
