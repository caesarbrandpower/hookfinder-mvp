import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const anthropic =
  ANTHROPIC_API_KEY && ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here'
    ? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
    : null;

interface NewsArticle {
  title: string;
  content: string;
  url: string;
}

interface NewsData {
  results: NewsArticle[];
  answer: string;
}

export async function POST(request: NextRequest) {
  try {
    const {
      hook,
      explanation,
      websiteContent,
      newsData,
      companyName,
      sector,
    }: {
      hook: string;
      explanation?: string;
      websiteContent?: string;
      newsData?: NewsData;
      companyName: string;
      sector?: string;
    } = await request.json();

    if (!hook || !companyName) {
      return NextResponse.json(
        { error: 'Hook en bedrijfsnaam zijn verplicht' },
        { status: 400 }
      );
    }

    if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
      return NextResponse.json(
        { error: 'Anthropic API key niet geconfigureerd' },
        { status: 500 }
      );
    }

    if (!anthropic) {
      return NextResponse.json(
        { error: 'Claude client niet geïnitialiseerd' },
        { status: 500 }
      );
    }

    const prompt = buildPrompt({
      hook,
      explanation,
      websiteContent,
      newsData,
      companyName,
      sector,
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1200,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return NextResponse.json(
        { error: 'Onverwachte respons van Claude' },
        { status: 500 }
      );
    }

    return NextResponse.json({ pressRelease: content.text.trim() });
  } catch (error) {
    console.error('Press release error:', error);
    return NextResponse.json(
      { error: 'Er is een fout opgetreden bij het genereren van de persbericht-aanzet' },
      { status: 500 }
    );
  }
}

function buildPrompt({
  hook,
  explanation,
  websiteContent,
  newsData,
  companyName,
  sector,
}: {
  hook: string;
  explanation?: string;
  websiteContent?: string;
  newsData?: NewsData;
  companyName: string;
  sector?: string;
}): string {
  let prompt = `Je bent een PR-strateeg die een persbericht-aanzet schrijft voor een Nederlands PR-bureau.

Schrijf een persbericht-aanzet van maximaal 300 woorden op basis van de gegeven hook, website-informatie en actuele nieuwscontext.

Houd je strikt aan deze structuur, met duidelijke kopjes tussen elk onderdeel:

KOPTITEL
Eén nieuwswaardige kop op basis van de hook. Geen clickbait. Maximaal 12 woorden.

OPENINGSPARAGRAAF
De hook uitgeschreven als nieuwsfeit. Wie, wat, waar, wanneer. Maximaal 3 zinnen.

TWEEDE ALINEA
Context: wie is het merk, waarom is dit nu relevant. Gebruik de website-informatie en nieuwscontext om dit te onderbouwen. Maximaal 4 zinnen.

CITAAT
Een fictief citaat namens een woordvoerder van het merk. Begin met: [PLACEHOLDER CITAAT — naam en functie in te vullen door het merk]. Daarna één of twee krachtige zinnen die passen bij de hook en het merk.

AFSLUITENDE ALINEA
Call to action of vervolginfo. Waar kan een journalist terecht voor meer informatie, of welke stap volgt er nu. Maximaal 3 zinnen. Eindig met een [PLACEHOLDER CONTACT — perscontact in te vullen].

Regels:
- Schrijf in het Nederlands, zakelijk en helder.
- Geen verzonnen feiten of cijfers. Gebruik alleen wat in de input staat.
- Totaal maximaal 300 woorden, inclusief kopjes.
- Geen em dashes.
- Geen opmaak zoals markdown (geen **, geen #).

`;

  prompt += `BEDRIJFSNAAM: ${companyName}\n`;
  if (sector) {
    prompt += `THEMA: ${sector}\n`;
  }
  prompt += `\nGEKOZEN HOOK:\n${hook}\n`;
  if (explanation) {
    prompt += `\nTOELICHTING BIJ HOOK:\n${explanation}\n`;
  }
  prompt += `\n`;

  if (websiteContent && websiteContent.length > 0) {
    prompt += `=== WEBSITE CONTENT ===\n${websiteContent.substring(0, 3000)}\n\n`;
  } else {
    prompt += `=== WEBSITE CONTENT ===\n[Geen website content beschikbaar]\n\n`;
  }

  if (newsData && newsData.results && newsData.results.length > 0) {
    prompt += `=== ACTUEEL NIEUWS ===\n`;
    if (newsData.answer) {
      prompt += `Samenvatting: ${newsData.answer}\n\n`;
    }
    newsData.results.slice(0, 5).forEach((article, index) => {
      prompt += `Artikel ${index + 1}:\n`;
      prompt += `Titel: ${article.title}\n`;
      prompt += `Content: ${article.content?.substring(0, 400) || 'Geen content'}\n\n`;
    });
  } else {
    prompt += `=== ACTUEEL NIEUWS ===\n[Geen nieuwsdata beschikbaar]\n\n`;
  }

  prompt += `Schrijf nu de persbericht-aanzet volgens de gevraagde structuur.`;

  return prompt;
}
