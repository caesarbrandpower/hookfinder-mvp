import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const anthropic =
  ANTHROPIC_API_KEY && ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here'
    ? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
    : null;

type ContentType = 'persbericht' | 'linkedin' | 'pitch' | 'nieuwsbrief';

interface NewsArticle {
  title: string;
  content: string;
  url: string;
}

interface NewsData {
  results: NewsArticle[];
  answer: string;
}

const TYPE_GUIDELINES: Record<ContentType, { label: string; maxTokens: number; instructions: string }> = {
  persbericht: {
    label: 'Persbericht',
    maxTokens: 1200,
    instructions: `Schrijf een persbericht van maximaal 300 woorden met deze structuur, met duidelijke kopjes tussen elk onderdeel:

KOPTITEL
Eén nieuwswaardige kop op basis van de hook. Geen clickbait. Maximaal 12 woorden.

OPENINGSPARAGRAAF
De hook uitgeschreven als nieuwsfeit. Wie, wat, waar, wanneer. Maximaal 3 zinnen.

CONTEXT
Wie is het merk, waarom is dit nu relevant. Gebruik de website-informatie en nieuwscontext. Maximaal 4 zinnen.

CITAAT
Een fictief citaat namens een woordvoerder. Begin met: [PLACEHOLDER CITAAT — naam en functie in te vullen door het merk]. Daarna één of twee krachtige zinnen.

AFSLUITENDE ALINEA
Call to action of vervolginfo. Maximaal 3 zinnen. Eindig met [PLACEHOLDER CONTACT — perscontact in te vullen].`,
  },
  linkedin: {
    label: 'LinkedIn-post',
    maxTokens: 700,
    instructions: `Schrijf een LinkedIn-post van maximaal 150 woorden.
- Persoonlijke, menselijke toon (ik-vorm of directe vorm).
- Eén sterke openingszin die meteen de aandacht grijpt.
- Bouw daarna het verhaal kort op, één kernpunt.
- Eindig met een vraag aan de lezer of een duidelijke call to action.
- Geen hashtags. Geen emoji. Geen markdown.`,
  },
  pitch: {
    label: 'Pitch-mail journalist',
    maxTokens: 600,
    instructions: `Schrijf een pitch-mail aan een journalist van maximaal 100 woorden.
- Begin met een regel: "Onderwerp: ..." met een pakkende onderwerpregel.
- Daarna een directe aanhef: "Beste [naam journalist],".
- Korte pitch van maximaal 3 zinnen die uitlegt waarom dit verhaal nu relevant is voor zijn of haar publiek.
- Sluit af met een concrete call to action (interview, embargo, beeldmateriaal, etc.).
- Eindig met "Groet, [PLACEHOLDER AFZENDER]".`,
  },
  nieuwsbrief: {
    label: 'Nieuwsbrief-intro',
    maxTokens: 500,
    instructions: `Schrijf een nieuwsbrief-intro van maximaal 80 woorden.
- Warme, directe toon, alsof je een bekende lezer aanspreekt.
- Maakt nieuwsgierig naar het volledige verhaal zonder alles te verklappen.
- Eindig met een zin die de lezer verleidt om door te klikken.
- Geen kopjes, gewoon lopende tekst.`,
  },
};

export async function POST(request: NextRequest) {
  try {
    const {
      type,
      hook,
      explanation,
      websiteContent,
      newsData,
      companyName,
      sector,
    }: {
      type: ContentType;
      hook: string;
      explanation?: string;
      websiteContent?: string;
      newsData?: NewsData;
      companyName: string;
      sector?: string;
    } = await request.json();

    if (!hook || !companyName || !type) {
      return NextResponse.json(
        { error: 'Type, hook en bedrijfsnaam zijn verplicht' },
        { status: 400 }
      );
    }

    const guideline = TYPE_GUIDELINES[type];
    if (!guideline) {
      return NextResponse.json(
        { error: `Onbekend content-type: ${type}` },
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
      guideline: guideline.instructions,
      typeLabel: guideline.label,
      hook,
      explanation,
      websiteContent,
      newsData,
      companyName,
      sector,
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: guideline.maxTokens,
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

    return NextResponse.json({ type, content: content.text.trim() });
  } catch (error) {
    console.error('Content generation error:', error);
    return NextResponse.json(
      { error: 'Er is een fout opgetreden bij het genereren van de content' },
      { status: 500 }
    );
  }
}

function buildPrompt({
  guideline,
  typeLabel,
  hook,
  explanation,
  websiteContent,
  newsData,
  companyName,
  sector,
}: {
  guideline: string;
  typeLabel: string;
  hook: string;
  explanation?: string;
  websiteContent?: string;
  newsData?: NewsData;
  companyName: string;
  sector?: string;
}): string {
  let prompt = `Je bent een Nederlandse PR-strateeg. Je zet een gekozen PR-hook om naar een ${typeLabel}.

${guideline}

Algemene regels:
- Schrijf in het Nederlands.
- Geen verzonnen feiten of cijfers. Gebruik alleen wat in de input staat.
- Geen em dashes.
- Geen markdown opmaak (geen **, geen #, geen backticks).

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
      prompt += `URL: ${article.url}\n`;
      prompt += `Content: ${article.content?.substring(0, 400) || 'Geen content'}\n\n`;
    });
  } else {
    prompt += `=== ACTUEEL NIEUWS ===\n[Geen nieuwsdata beschikbaar]\n\n`;
  }

  prompt += `Schrijf nu de ${typeLabel} volgens de gevraagde richtlijnen. Geef alleen de content terug, zonder toelichting vooraf of achteraf.`;

  return prompt;
}
