# HookFinder MVP

Een tool voor PR-bureaus waarmee gebruikers een URL of bedrijfsnaam kunnen invoeren en binnen een minuut 5 concrete PR-hooks terugkrijgen.

## Wat de tool doet

HookFinder combineert twee bronnen:
1. **Website content** — gescraped via Jina AI (https://r.jina.ai/)
2. **Actueel nieuws en trending topics** — via de Tavily API

Claude analyseert beide bronnen en genereert 5 PR-hooks. Elke hook bestaat uit:
- **De hook**: één krachtige zin die een journalist aan het denken zet
- **Toelichting**: twee zinnen over relevantie en geschikte media

## Gebruikersflow

1. **Stap 1**: Gebruiker voert URL of bedrijfsnaam in (verplicht), optioneel sector/thema
2. **Stap 2**: Laadstatus toont voortgang van de analyse
3. **Stap 3**: 5 genummerde PR-hooks verschijnen, elk kopieerbaar
4. **Stap 4**: Fallback werkt automatisch als website niet scrapebaar is

## Tech Stack

- **Framework**: Next.js 16 + TypeScript + Tailwind CSS
- **Scraper**: Jina AI
- **Nieuws/trends**: Tavily API
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514)
- **Icons**: Lucide React

## Lokale installatie

### Vereisten

- Node.js 18+ 
- npm of yarn

### Stap 1: Clone en installeer dependencies

```bash
cd hookfinder-mvp
npm install
```

### Stap 2: Configureer environment variables

Kopieer het voorbeeldbestand:

```bash
cp .env.local.example .env.local
```

Vul je API keys in in `.env.local`:

```env
# Anthropic Claude API Key
# Verkrijg via: https://console.anthropic.com/
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Tavily API Key
# Verkrijg via: https://tavily.com/
TAVILY_API_KEY=your_tavily_api_key_here
```

### Stap 3: Start de development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in je browser.

## Environment Variables

| Variable | Beschrijving | Verkrijgen |
|----------|--------------|------------|
| `ANTHROPIC_API_KEY` | API key voor Claude | https://console.anthropic.com/ |
| `TAVILY_API_KEY` | API key voor nieuws search | https://tavily.com/ |

## API Routes

### POST /api/scrape
Scraped een website via Jina AI.

**Input**: `{ url: string }`
**Output**: `{ content: string, wordCount: number, usable: boolean }`

### POST /api/news
Haalt actueel nieuws op via Tavily.

**Input**: `{ query: string, sector?: string }`
**Output**: `{ results: Array, answer: string }`

### POST /api/generate
Genereert PR-hooks via Claude.

**Input**: `{ websiteContent: string, newsData: object, companyName: string, sector?: string }`
**Output**: `{ hooks: Array<{hook: string, explanation: string}> }`

## Claude API Prompt

De tool gebruikt de volgende exacte prompt voor Claude:

```
Je bent een PR-strateeg. Je krijgt twee soorten input: (1) tekst van de website van een merk, en (2) actueel nieuws en trending topics rond dat merk of die sector.

Genereer op basis van deze combinatie 5 PR-hooks voor een PR-bureau dat dit merk als klant heeft.

Elke hook bestaat uit:
- De hook: één krachtige zin die een journalist aan het denken zet. Concreet, actueel, nieuwswaardig.
- Toelichting: twee zinnen. Waarom is dit nu relevant? Voor welk type medium of journalist is dit interessant?

Regels:
- Maak de hooks specifiek voor dit merk en dit moment. Geen generieke PR-adviezen.
- Combineer altijd het merkperspectief met actuele context. Een hook zonder actuele haak is te zwak.
- Als er onvoldoende informatie is voor een sterke hook: benoem dat eerlijk in de toelichting.
- Schrijf in het Nederlands, tenzij de input volledig in het Engels is.
```

## Fallback Gedrag

Als een website niet scrapebaar is (minder dan 100 woorden bruikbare tekst):
- Geen foutmelding
- De tool gaat door met alleen Tavily-resultaten op basis van de bedrijfsnaam
- Gebruiker ziet een melding: "Website kon niet worden gescraped. Resultaten gebaseerd op nieuws en bedrijfsnaam."

## Gemaakte Keuzes

1. **Laadstatus animatie**: Progress indicator met 5 stappen om gebruiker feedback te geven over het proces
2. **UI Design**: Schone, professionele interface met indigo als primaire kleur
3. **Kopieer-functionaliteit**: Elke hook individueel kopieerbaar + "kopieer alles" optie
4. **Error handling**: Duidelijke foutmeldingen zonder technische details
5. **Responsive**: Werkt op desktop en mobiel

## Wat nog ontbreekt / niet af is

- Geen rate limiting op API routes
- Geen caching van resultaten
- Geen gebruikerssessies of historie
- Geen export naar PDF/Word
- Geen integratie met nieuwsbrieftools

## Reviewcriteria Checklist

- [x] Tool draait lokaal zonder errors na `npm install && npm run dev`
- [x] URL of bedrijfsnaam invoeren leidt tot 5 zichtbare hooks
- [x] Elke hook heeft een toelichting
- [x] Output is kopieerbaar
- [x] Scraper-fallback werkt
- [x] Geen hardcoded API keys in de code

## Deployment

Deployment wordt gedaan door Caesar via Vercel na review. Niet door Kimi.

## Contact

Voor vragen of issues: Caesar
