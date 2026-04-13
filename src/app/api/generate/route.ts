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

    // Bouw de prompt
    const prompt = buildPrompt(websiteContent, newsData, googleNews, companyName, sector);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
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

    // Parse de JSON respons. Claude geeft soms de JSON terug in een code-fence of
    // met wat tekst eromheen, dus halen we eerst het JSON-object eruit.
    const rawText = content.text;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : rawText;

    try {
      const parsed = JSON.parse(jsonString);
      const hooks = Array.isArray(parsed) ? parsed : parsed.hooks;
      if (!Array.isArray(hooks)) {
        throw new Error('Geen hooks array gevonden');
      }
      return NextResponse.json({ hooks });
    } catch (parseError) {
      console.error('JSON parse error:', parseError, '\nRaw:', rawText.slice(0, 500));
      return NextResponse.json({
        hooks: parseTextResponse(rawText),
      });
    }
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

  let prompt = `Je werkt als een ervaren PR-strateeg volgens bewezen methodieken:

1. NEWSJACKING (David Meerman Scott): Zoek het exacte moment waarop dit merk kan inhaken op een lopend nieuwsverhaal. Timing is alles - de haak moet nu relevant zijn.
2. SO WHAT TEST (Michael Smart): Elke hook moet direct beantwoorden waarom dit nu relevant is voor een journalist. Als je "en dan?" denkt, is hij niet sterk genoeg.
3. LEZER CENTRAAL (Ann Handley): Schrijf altijd vanuit het perspectief van de journalist of lezer, nooit vanuit het merk.
4. INVERTED PYRAMID: Bij persberichten altijd het belangrijkste eerst. De nieuwshaak in de eerste zin, niet de bedrijfsintroductie.

Je krijgt twee soorten input: (1) tekst van de website van een merk, en (2) actueel nieuws en trending topics rond dat merk of die sector.

Genereer op basis van deze combinatie 5 PR-hooks voor een PR-bureau dat dit merk als klant heeft.

Elke hook bestaat uit:
- De hook: één krachtige zin die een journalist aan het denken zet. Concreet, actueel, nieuwswaardig.
- Toelichting: twee zinnen. Waarom is dit nu relevant? Voor welk type medium of journalist is dit interessant?
- Bronnen: een lijst van maximaal 3 nieuwsbronnen (titel + url) uit de meegeleverde artikelen die daadwerkelijk de basis vormen voor deze hook. Als de hook niet op nieuws gebaseerd is, laat de lijst leeg.

Regels:
- Maak de hooks specifiek voor dit merk en dit moment. Geen generieke PR-adviezen.
- Combineer altijd het merkperspectief met actuele context. Een hook zonder actuele haak is te zwak.
- Als er onvoldoende informatie is voor een sterke hook: benoem dat eerlijk in de toelichting.
- Schrijf in het Nederlands, tenzij de input volledig in het Engels is.
- Genereer 5 hooks waarbij elke hook een duidelijk andere invalshoek heeft. Varieer tussen: merkpositionering, maatschappelijke relevantie, sector-trends, business-angle en human interest. Maximaal 2 hooks mogen over hetzelfde nieuws-item gaan.

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

Gebruik voor "sources" alleen artikelen die letterlijk in de lijst hieronder staan. Verzin geen titels of urls. Kopieer de titel en url exact zoals ze in de input staan. Maximaal 3 bronnen per hook.

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
