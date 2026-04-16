import { NextRequest, NextResponse } from 'next/server';
import Parser from 'rss-parser';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const rssParser = new Parser();

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

interface GoogleNewsItem {
  title: string;
  url: string;
  pubDate: string;
}

async function fetchGoogleNews(query: string): Promise<GoogleNewsItem[]> {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://news.google.com/rss/search?q=${encoded}&hl=nl&gl=NL&ceid=NL:nl`;
    const feed = await rssParser.parseURL(url);

    return (feed.items || []).slice(0, 5).map((item) => ({
      title: item.title || '',
      url: item.link || '',
      pubDate: item.pubDate || '',
    }));
  } catch (error) {
    console.error('Google News RSS error:', error);
    return [];
  }
}

// Extraheert het domein uit een bedrijfsnaam of URL (bijv. "lezen.nl", "https://lezen.nl/foo")
function extractDomain(query: string): string {
  try {
    const withProtocol = query.startsWith('http') ? query : `https://${query}`;
    return new URL(withProtocol).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return query.toLowerCase().replace(/^www\./, '');
  }
}

// Filtert resultaten waarvan de URL afkomstig is van het eigen domein van het merk
function filterOwnDomain(
  results: Array<{ title: string; content: string; url: string }>,
  domain: string
): Array<{ title: string; content: string; url: string }> {
  if (!domain) return results;
  return results.filter((r) => !r.url.toLowerCase().includes(domain));
}

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

    const companyDomain = extractDomain(query);

    // sectorQuery: gebruik sector als opgegeven, anders bredere branche-termen
    const sectorQuery = sector || `${query} branche sector trends ontwikkelingen`;
    const googleQuery = sector ? `${sector} nieuws Nederland` : `${query} sector nieuws`;

    const [rawBrandNews, rawSectorNews, googleNews] = await Promise.all([
      fetchTavily(query, lang, period, mediaType),
      fetchTavily(sectorQuery, lang, period, mediaType),
      fetchGoogleNews(googleQuery),
    ]);

    // Verwijder eigen-domein resultaten zodat Claude externe bronnen citeert
    const brandNews = {
      ...rawBrandNews,
      results: filterOwnDomain(rawBrandNews.results, companyDomain),
    };
    const sectorNews = {
      ...rawSectorNews,
      results: filterOwnDomain(rawSectorNews.results, companyDomain),
    };

    console.log(`News: brandNews ${brandNews.results.length} results, sectorNews ${sectorNews.results.length} results, googleNews ${googleNews.length} items`);

    return NextResponse.json({
      brandNews,
      sectorNews,
      googleNews,
    });
  } catch (error) {
    console.error('News fetch error:', error);
    const message = error instanceof Error ? error.message : 'Onbekende fout';
    return NextResponse.json(
      { error: `Nieuws niet beschikbaar: ${message}`, stage: 'news' },
      { status: 500 }
    );
  }
}

async function fetchTavily(
  query: string,
  lang: LangFilter,
  period: PeriodFilter,
  mediaType: MediaTypeFilter,
): Promise<{ results: Array<{ title: string; content: string; url: string }>; answer: string }> {
  if (!TAVILY_API_KEY || TAVILY_API_KEY === 'your_tavily_api_key_here') {
    console.warn('Tavily API key niet geconfigureerd, overslaan');
    return { results: [], answer: '' };
  }

  const base = `${query} nieuws`;
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
    return { results: [], answer: '' };
  }

  const data = await response.json();
  return {
    results: data.results || [],
    answer: data.answer || '',
  };
}
