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
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: 'Je bent een PR-strateeg. Antwoord UITSLUITEND met valide JSON. Geen tekst, uitleg of markdown code-fences rondom de JSON. Begin direct met { en eindig met }.',
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

    // Strip markdown code fences als die er zijn
    let cleaned = rawText.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim();
    }

    // Probeer eerst de hele cleaned text als JSON
    let hooks: Array<{ hook: string; explanation: string; sources?: Array<{ title: string; url: string }> }> | null = null;

    for (const candidate of [cleaned, rawText]) {
      try {
        const parsed = JSON.parse(candidate.trim());
        const arr = Array.isArray(parsed) ? parsed : parsed.hooks;
        if (Array.isArray(arr) && arr.length > 0) {
          hooks = arr;
          break;
        }
      } catch {
        // probeer JSON-object te extraheren
        const jsonMatch = candidate.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            const arr = Array.isArray(parsed) ? parsed : parsed.hooks;
            if (Array.isArray(arr) && arr.length > 0) {
              hooks = arr;
              break;
            }
          } catch {
            // volgende candidate
          }
        }
      }
    }

    if (hooks) {
      return NextResponse.json({ hooks });
    }

    console.error('JSON parse failed for all strategies.\nRaw:', rawText.slice(0, 800));
    return NextResponse.json({
      hooks: parseTextResponse(rawText),
    });
  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json(
      { error: 'Er is een fout opgetreden bij het genereren van hooks' },
      { status: 500 }
    );
  }
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

  let prompt = `Je bent een ervaren PR-strateeg. Je taak is om voor een PR-bureau actuele haakjes te vinden waarop een merk kan inhaken.

JE WERKT IN DRIE STAPPEN:

STAP 1 — SCAN DE BRONNEN:
Je krijgt twee soorten input:
- MERKNIEUWS: nieuws waar het merk zelf in voorkomt
- SECTORCONTEXT: actuele trends en nieuws in de sector

STAP 2 — SELECTEER DE STERKSTE HAAKJES:
Gebruik deze filters om te beoordelen welk nieuws een sterke hook oplevert:
- Newsjacking (David Meerman Scott): is er een actueel moment waarop het merk nu kan inhaken?
- So What Test (Michael Smart): is direct duidelijk waarom dit relevant is voor een journalist?
- Lezer centraal (Ann Handley): gaat de hook over de lezer, niet over het merk?

STAP 3 — SCHRIJF DE HOOKS:
Schrijf 5 hooks. Gebruik hierbij deze prioriteitvolgorde:
1. Eerst: hooks gebaseerd op MERKNIEUWS waar het merk al in voorkomt
2. Daarna: sectorhooks waarbij het merk expliciet kan inhaken op actuele context

Voor elke hook:
- HOOK: een scherpe zin van maximaal 12 woorden. Triggert. Zet aan tot lezen.
- TOELICHTING: twee zinnen. Waarom nu relevant? Voor welk medium?
- Bij sectorhooks: voeg toe "Sectorhaak: [merknaam] kan hierop inhaken omdat..."

Als er onvoldoende materiaal is voor 5 hooks: schrijf alleen de hooks die echt sterk zijn. Liever 3 sterke hooks dan 5 zwakke.

Schrijf in het Nederlands, tenzij de input volledig in het Engels is.
Varieer tussen: merkpositionering, maatschappelijke relevantie, sector-trends, business-angle, human interest.

Bronnen:
- Voeg per hook een lijst van maximaal 3 nieuwsbronnen (titel + url) toe uit de meegeleverde artikelen die daadwerkelijk de basis vormen voor deze hook.
- Gebruik voor "sources" alleen artikelen die letterlijk in de input hieronder staan. Verzin geen titels of urls. Kopieer de titel en url exact.

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

// Fallback parser als JSON parsing faalt
function parseTextResponse(text: string): Array<{ hook: string; explanation: string }> {
  const hooks: Array<{ hook: string; explanation: string }> = [];
  
  // Probeer hooks te extraheren met regex
  const hookMatches = text.match(/(?:Hook \d+|\d+\.)[:\s]*([^\n]+)/gi);
  
  if (hookMatches) {
    hookMatches.forEach((match, index) => {
      const lines = text.split('\n');
      const hookLine = match.replace(/(?:Hook \d+|\d+\.)[:\s]*/i, '').trim();
      
      // Zoek toelichting na de hook
      let explanation = '';
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(match) || lines[i].includes(hookLine)) {
          // Neem de volgende 2-3 niet-lege regels als toelichting
          let expLines = [];
          for (let j = i + 1; j < lines.length && expLines.length < 3; j++) {
            if (lines[j].trim() && !lines[j].match(/^(Hook \d+|\d+\.)[:\s]*/i)) {
              expLines.push(lines[j].trim());
            }
          }
          explanation = expLines.join(' ');
          break;
        }
      }
      
      hooks.push({
        hook: hookLine,
        explanation: explanation || 'Toelichting niet gevonden in de output.',
      });
    });
  }

  // Als we geen hooks konden parsen, return een fallback
  if (hooks.length === 0) {
    return [
      {
        hook: 'Kon hooks niet correct genereren. Controleer de API configuratie.',
        explanation: 'Er is een probleem opgetreden bij het parsen van de Claude output.',
      },
    ];
  }

  return hooks;
}
