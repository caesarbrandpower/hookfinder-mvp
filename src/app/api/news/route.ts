import { NextRequest, NextResponse } from 'next/server';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

type LangFilter = 'international' | 'nl' | 'en';
type PeriodFilter = 'week' | 'day' | 'month';
type MediaTypeFilter = 'all' | 'vakbladen' | 'dagbladen';

const PERIOD_DAYS: Record<PeriodFilter, number> = {
  day: 1,
  week: 7,
  month: 30,
};

const MEDIA_TYPE_QUERY: Record<MediaTypeFilter, string> = {
  all: '',
  vakbladen: ' (vakblad OR brancheblad)',
  dagbladen: ' (nieuws OR krant)',
};

export async function POST(request: NextRequest) {
  try {
    const {
      query,
      sector,
      lang = 'international',
      period = 'week',
      mediaType = 'all',
    }: {
      query: string;
      sector?: string;
      lang?: LangFilter;
      period?: PeriodFilter;
      mediaType?: MediaTypeFilter;
    } = await request.json();

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
    const base = sector ? `${query} ${sector} nieuws trends` : `${query} nieuws trends`;
    const mediaSuffix = MEDIA_TYPE_QUERY[mediaType] ?? '';
    const searchQuery = `${base}${mediaSuffix}`;

    const days = PERIOD_DAYS[period] ?? 7;

    const tavilyBody: Record<string, unknown> = {
      query: searchQuery,
      search_depth: 'advanced',
      include_answer: true,
      max_results: 10,
      topic: 'news',
      days,
    };

    if (lang === 'nl' || lang === 'en') {
      tavilyBody.search_lang = lang;
    }

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify(tavilyBody),
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
