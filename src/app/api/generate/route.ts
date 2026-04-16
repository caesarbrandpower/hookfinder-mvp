import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const anthropic = ANTHROPIC_API_KEY && ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here'
  ? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  : null;

export async function POST(request: NextRequest) {
  try {
    const { websiteContent, brandNews, sectorNews, googleNews, companyName, sector } = await request.json();

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

    // Normaliseer input
    const safeBrandNews = brandNews && brandNews.results ? brandNews : { results: [], answer: '' };
    const safeSectorNews = sectorNews && sectorNews.results ? sectorNews : { results: [], answer: '' };
    const safeGoogleNews = Array.isArray(googleNews) ? googleNews : [];

    // Bouw de prompt
    const prompt = buildPrompt(websiteContent || '', safeBrandNews, safeSectorNews, safeGoogleNews, companyName, sector);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: 'Je bent een PR-strateeg. Antwoord UITSLUITEND met valide JSON. Geen tekst, uitleg of markdown code-fences rondom de JSON. Begin direct met { en eindig met }. Houd elke hook-tekst onder 15 woorden en elke toelichting onder 40 woorden.',
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

    // Parse de JSON respons
    const rawText = content.text;
    console.log('Claude raw output (first 500):', rawText.slice(0, 500));

    const hooks = extractHooks(rawText);

    if (hooks) {
      return NextResponse.json({ hooks });
    }

    console.error('JSON parse failed.\nFull Claude output:', rawText);
    return NextResponse.json(
      {
        error: `Claude gaf geen valide JSON terug. Raw output: "${rawText.slice(0, 200)}"`,
        stage: 'claude-parse',
      },
      { status: 502 }
    );
  } catch (error) {
    console.error('Generate error:', error);
    const message = error instanceof Error ? error.message : 'Onbekende fout';
    return NextResponse.json(
      { error: `Hooks niet gegenereerd: ${message}`, stage: 'claude-call' },
      { status: 500 }
    );
  }
}

type Hook = { hook: string; explanation: string; sources?: Array<{ title: string; url: string }> };

// Extraheert JSON via brace counting — betrouwbaarder dan regex op grote tekst
function extractJsonObject(text: string): object | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

function extractHooks(rawText: string): Hook[] | null {
  // Strip markdown fences
  let text = rawText.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  // Probeer directe parse
  for (const candidate of [text, rawText.trim()]) {
    try {
      const parsed = JSON.parse(candidate);
      const arr = Array.isArray(parsed) ? parsed : (parsed as Record<string, unknown>).hooks;
      if (Array.isArray(arr) && arr.length > 0) return arr as Hook[];
    } catch { /* next */ }
  }

  // Brace-counting extractie
  const obj = extractJsonObject(text) ?? extractJsonObject(rawText);
  if (obj) {
    const arr = (obj as Record<string, unknown>).hooks;
    if (Array.isArray(arr) && arr.length > 0) return arr as Hook[];
  }

  return null;
}

function buildPrompt(
  websiteContent: string,
  brandNews: { results: Array<{ title: string; content: string; url: string }>; answer: string },
  sectorNews: { results: Array<{ title: string; content: string; url: string }>; answer: string },
  googleNews: Array<{ title: string; url: string; pubDate: string }> | undefined,
  companyName: string,
  sector?: string
): string {
  const hasWebsiteContent = websiteContent && websiteContent.length > 0;
  const hasBrandNews = brandNews && brandNews.results && brandNews.results.length > 0;
  const hasSectorNews = sectorNews && sectorNews.results && sectorNews.results.length > 0;
  const hasGoogleNews = googleNews && googleNews.length > 0;

  let prompt = `Je bent een PR-strateeg. Genereer precies 5 PR-hooks voor het gegeven merk.

REGELS:
- Hook: max 12 woorden, scherp en triggend
- Toelichting: max 2 korte zinnen (waarom nu relevant, voor welk medium)
- Prioriteit: eerst merknieuws, dan sectorhooks aanvullen tot 5
- Sectorhooks: begin toelichting met "Sectorhaak:"
- Taal: Nederlands (tenzij input volledig Engels)
- Sources: max 2 per hook, alleen urls die letterlijk in de input staan

COMPACT HOUDEN: Schrijf beknopt. Elke toelichting max 40 woorden.

Geef de output in het volgende JSON formaat:
{
  "hooks": [
    {
      "hook": "De hook tekst",
      "explanation": "De toelichting tekst",
      "sources": [
        { "title": "Exacte titel van het artikel", "url": "https://..." }
      ]
    }
  ]
}

`;

  // Bedrijfsinformatie
  prompt += `BEDRIJFSNAAM: ${companyName}\n`;
  if (sector) {
    prompt += `SECTOR/THEMA: ${sector}\n`;
  }
  prompt += `\n`;

  // Website content
  if (hasWebsiteContent) {
    prompt += `=== WEBSITE CONTENT ===\n${websiteContent.substring(0, 3000)}\n\n`;
  } else {
    prompt += `=== WEBSITE CONTENT ===\n[Geen website content beschikbaar]\n\n`;
  }

  // Merknieuws
  if (hasBrandNews) {
    prompt += `=== MERKNIEUWS: nieuws waar ${companyName} in voorkomt ===\n`;
    if (brandNews.answer) {
      prompt += `Samenvatting: ${brandNews.answer}\n\n`;
    }
    brandNews.results.slice(0, 5).forEach((article, index) => {
      prompt += `Artikel ${index + 1}:\n`;
      prompt += `Titel: ${article.title}\n`;
      prompt += `URL: ${article.url}\n`;
      prompt += `Content: ${article.content?.substring(0, 500) || 'Geen content'}\n\n`;
    });
  } else {
    prompt += `=== MERKNIEUWS ===\n[Geen merkspecifiek nieuws gevonden voor ${companyName}]\n\n`;
  }

  // Sectorcontext
  if (hasSectorNews) {
    prompt += `=== SECTORCONTEXT: actuele trends en nieuws in de sector ===\n`;
    if (sectorNews.answer) {
      prompt += `Samenvatting: ${sectorNews.answer}\n\n`;
    }
    sectorNews.results.slice(0, 5).forEach((article, index) => {
      prompt += `Artikel ${index + 1}:\n`;
      prompt += `Titel: ${article.title}\n`;
      prompt += `URL: ${article.url}\n`;
      prompt += `Content: ${article.content?.substring(0, 500) || 'Geen content'}\n\n`;
    });
  } else {
    prompt += `=== SECTORCONTEXT ===\n[Geen sectornieuws beschikbaar]\n\n`;
  }

  // Google News RSS (sectorcontext)
  if (hasGoogleNews) {
    prompt += `=== SECTORCONTEXT: Google News ===\n`;
    googleNews.slice(0, 5).forEach((item, index) => {
      prompt += `Artikel ${index + 1}:\n`;
      prompt += `Titel: ${item.title}\n`;
      prompt += `URL: ${item.url}\n`;
      prompt += `Datum: ${item.pubDate}\n\n`;
    });
  } else {
    prompt += `=== SECTORCONTEXT: Google News ===\n[Geen Google News resultaten beschikbaar]\n\n`;
  }

  prompt += `Genereer nu PR-hooks in het gevraagde JSON formaat. Prioriteit: eerst merknieuws, dan sectorhooks.`;

  return prompt;
}

