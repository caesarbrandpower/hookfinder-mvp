import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is verplicht' },
        { status: 400 }
      );
    }

    // Normaliseer URL (Jina wil een volledige URL met protocol)
    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;

    // Jina AI Reader: URL wordt als path suffix doorgegeven, NIET url-encoded
    const jinaUrl = `https://r.jina.ai/${normalizedUrl}`;

    const jinaHeaders: Record<string, string> = {
      Accept: 'application/json',
    };
    if (process.env.JINA_API_KEY) {
      jinaHeaders.Authorization = `Bearer ${process.env.JINA_API_KEY}`;
    }

    const response = await fetch(jinaUrl, {
      method: 'GET',
      headers: jinaHeaders,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('Jina error:', response.status, errText.slice(0, 200));
      return NextResponse.json(
        { error: 'Kon website niet scrapen', content: '', usable: false },
        { status: 200 }
      );
    }

    // Jina geeft soms text/markdown terug; vang dat veilig af
    const contentType = response.headers.get('content-type') || '';
    let content = '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      content = data?.data?.content || data?.content || '';
    } else {
      content = await response.text();
    }

    // Tel woorden om te checken of er genoeg content is
    const wordCount = content.split(/\s+/).filter((word: string) => word.length > 0).length;

    if (wordCount < 100) {
      return NextResponse.json({
        content: '',
        wordCount,
        usable: false,
        message: 'Te weinig content gevonden op de website',
      });
    }

    return NextResponse.json({
      content,
      wordCount,
      usable: true,
    });
  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json(
      { error: 'Er is een fout opgetreden bij het scrapen', content: '' },
      { status: 200 }
    );
  }
}
