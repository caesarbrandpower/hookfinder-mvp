import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const anthropic = ANTHROPIC_API_KEY && ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here'
  ? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  : null;

export async function POST(request: NextRequest) {
  try {
    const { websiteContent, newsData, googleNews, companyName, sector } = await request.json();

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
    const safeNewsData = newsData && newsData.results ? newsData : { results: [], answer: '' };
    const safeGoogleNews = Array.isArray(googleNews) ? googleNews : [];

    // Bouw de prompt
    const prompt = buildPrompt(websiteContent || '', safeNewsData, safeGoogleNews, companyName, sector);

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
  newsData: { results: Array<{ title: string; content: string; url: string }>; answer: string },
  googleNews: Array<{ title: string; url: string; pubDate: string }> | undefined,
  companyName: string,
  sector?: string
): string {
  const hasWebsiteContent = websiteContent && websiteContent.length > 0;
  const hasNewsData = newsData && newsData.results && newsData.results.length > 0;
  const hasGoogleNews = googleNews && googleNews.length > 0;

  let prompt = `Je bent een ervaren PR-strateeg. Je werkt in twee stappen:

STAP 1 - BEOORDEEL:
Gebruik deze methodieken als intern filter om te bepalen welke hooks sterk zijn:
- Newsjacking (David Meerman Scott): is er een actueel nieuwsmoment waarop dit merk nu kan inhaken?
- So What Test (Michael Smart): is de relevantie voor een journalist direct duidelijk?
- Lezer centraal (Ann Handley): gaat de hook over de lezer of over het merk?
Selecteer alleen hooks die op alle drie de filters scoren.

STAP 2 - SCHRIJF:
Schrijf elke hook als twee aparte onderdelen:
- HOOK: een scherpe zin van maximaal 12 woorden. Triggert. Zet aan tot lezen. Geen uitleg in de hook zelf.
- TOELICHTING: twee zinnen. Waarom is dit nu relevant? Voor welk medium of journalist?

Bronnen:
- Voeg per hook een lijst van maximaal 3 nieuwsbronnen (titel + url) toe uit de meegeleverde artikelen die daadwerkelijk de basis vormen voor deze hook. Als de hook niet op nieuws gebaseerd is, laat de lijst leeg.
- Gebruik voor "sources" alleen artikelen die letterlijk in de input hieronder staan. Verzin geen titels of urls. Kopieer de titel en url exact.

Regels:
- Maximaal 2 hooks mogen over hetzelfde nieuws-item gaan
- Varieer tussen: merkpositionering, maatschappelijke relevantie, sector-trends, business-angle, human interest
- Schrijf in het Nederlands, tenzij de input volledig in het Engels is
- Vul nooit iets in dat je niet kunt onderbouwen vanuit de aangeleverde bronnen
- Vermijd hooks die geen actuele nieuwshaak hebben. Een verhaal dat al jaren bekend is zonder recent nieuws is geen hook. Als een hook alleen op historische feiten gebaseerd is, laat hem dan weg.

MERKCONTROLE — TWEE STAPPEN VERPLICHT:

Stap 1: Scan alle aangeleverde bronnen. Markeer alleen bronnen die het ingevoerde merk expliciet bij naam noemen. Bronnen die het merk niet bij naam noemen zijn niet bruikbaar, ook niet als ze over dezelfde sector gaan.

Stap 2: Schrijf alleen hooks gebaseerd op bronnen die de merkcontrole hebben doorstaan. Als er na de controle minder dan 5 bruikbare bronnen zijn, schrijf dan voor de ontbrekende hooks letterlijk: "Onvoldoende actueel nieuws gevonden over [merknaam] en [thema]." Verzin geen hook om het getal van 5 te halen.

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
    prompt += `SECTOR: ${sector}\n`;
  }
  prompt += `\n`;

  // Website content
  if (hasWebsiteContent) {
    prompt += `=== WEBSITE CONTENT ===\n${websiteContent.substring(0, 3000)}\n\n`;
  } else {
    prompt += `=== WEBSITE CONTENT ===\n[Geen website content beschikbaar]\n\n`;
  }

  // Nieuws data (Tavily)
  if (hasNewsData) {
    prompt += `=== ACTUEEL NIEUWS (Tavily) ===\n`;
    if (newsData.answer) {
      prompt += `Samenvatting: ${newsData.answer}\n\n`;
    }
    newsData.results.slice(0, 5).forEach((article, index) => {
      prompt += `Artikel ${index + 1}:\n`;
      prompt += `Titel: ${article.title}\n`;
      prompt += `URL: ${article.url}\n`;
      prompt += `Content: ${article.content?.substring(0, 500) || 'Geen content'}\n\n`;
    });
  } else {
    prompt += `=== ACTUEEL NIEUWS (Tavily) ===\n[Geen nieuwsdata beschikbaar]\n\n`;
  }

  // Google News RSS
  if (hasGoogleNews) {
    prompt += `=== GOOGLE NEWS ===\n`;
    googleNews.slice(0, 5).forEach((item, index) => {
      prompt += `Artikel ${index + 1}:\n`;
      prompt += `Titel: ${item.title}\n`;
      prompt += `URL: ${item.url}\n`;
      prompt += `Datum: ${item.pubDate}\n\n`;
    });
  } else {
    prompt += `=== GOOGLE NEWS ===\n[Geen Google News resultaten beschikbaar]\n\n`;
  }

  prompt += `Genereer nu 5 PR-hooks in het gevraagde JSON formaat. Gebruik beide nieuwsbronnen (Tavily en Google News) als context.`;

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
