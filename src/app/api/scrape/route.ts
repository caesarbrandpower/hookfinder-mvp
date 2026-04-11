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

    // Jina AI API endpoint
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;

    const response = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Kon website niet scrapen', content: '' },
        { status: 200 }
      );
    }

    const data = await response.json();
    const content = data.data?.content || '';

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
