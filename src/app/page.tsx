'use client';

import { useState } from 'react';
import { Search, Copy, Check, Newspaper, Globe, Loader2, FileText, Megaphone, Mail, Link2, ExternalLink } from 'lucide-react';

interface Source {
  title: string;
  url: string;
}

interface Hook {
  hook: string;
  explanation: string;
  sources?: Source[];
}

type ContentType = 'persbericht' | 'linkedin' | 'pitch' | 'nieuwsbrief';
type LangFilter = 'international' | 'nl' | 'en';
type PeriodFilter = 'week' | 'day' | 'month';
type MediaTypeFilter = 'all' | 'vakbladen' | 'dagbladen';

interface ContentTypeDef {
  id: ContentType;
  label: string;
  icon: typeof FileText;
}

const CONTENT_TYPES: ContentTypeDef[] = [
  { id: 'persbericht', label: 'Persbericht', icon: FileText },
  { id: 'linkedin', label: 'LinkedIn-post', icon: Link2 },
  { id: 'pitch', label: 'Pitch-mail journalist', icon: Mail },
  { id: 'nieuwsbrief', label: 'Nieuwsbrief-intro', icon: Megaphone },
];

const contentKey = (hookIndex: number, type: ContentType) => `${hookIndex}:${type}`;

interface NewsArticle {
  title: string;
  content: string;
  url: string;
}

interface NewsData {
  results: NewsArticle[];
  answer: string;
}

interface GenerationContext {
  websiteContent: string;
  newsData: NewsData;
  companyName: string;
  sector?: string;
}

interface LoadingState {
  message: string;
  step: number;
}

const loadingMessages: LoadingState[] = [
  { message: 'Website analyseren...', step: 1 },
  { message: 'Actueel nieuws verzamelen...', step: 2 },
  { message: 'PR-strategie ontwikkelen...', step: 3 },
  { message: 'Hooks genereren...', step: 4 },
  { message: 'Finaliseren...', step: 5 },
];

export default function Home() {
  const [input, setInput] = useState('');
  const [sector, setSector] = useState('');
  const [lang, setLang] = useState<LangFilter>('international');
  const [period, setPeriod] = useState<PeriodFilter>('week');
  const [mediaType, setMediaType] = useState<MediaTypeFilter>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [generationContext, setGenerationContext] = useState<GenerationContext | null>(null);
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({});
  const [contentLoading, setContentLoading] = useState<Record<string, boolean>>({});
  const [contentErrors, setContentErrors] = useState<Record<string, string>>({});
  const [activeContentType, setActiveContentType] = useState<Record<number, ContentType>>({});
  const [contentCopied, setContentCopied] = useState<string | null>(null);

  const isValidUrl = (str: string): boolean => {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  };

  const extractDomain = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim()) {
      setError('Voer een URL of bedrijfsnaam in');
      return;
    }

    setIsLoading(true);
    setError('');
    setHooks([]);
    setUsedFallback(false);
    setLoadingStep(0);
    setGenerationContext(null);
    setGeneratedContent({});
    setContentLoading({});
    setContentErrors({});
    setActiveContentType({});
    setContentCopied(null);

    try {
      const isUrl = isValidUrl(input);
      const companyName = isUrl ? extractDomain(input) : input;
      let websiteContent = '';
      let fallbackUsed = false;

      // Stap 1: Scrape website als het een URL is
      if (isUrl) {
        setLoadingStep(0);
        const scrapeResponse = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: input }),
        });

        if (scrapeResponse.ok) {
          const scrapeData = await scrapeResponse.json();
          if (scrapeData.usable) {
            websiteContent = scrapeData.content;
          } else {
            fallbackUsed = true;
          }
        } else {
          fallbackUsed = true;
        }
      }

      // Stap 2: Haal nieuws op
      setLoadingStep(1);
      const newsResponse = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: companyName,
          sector: sector || undefined,
          lang,
          period,
          mediaType,
        }),
      });

      let newsData: NewsData = { results: [], answer: '' };
      let googleNews: Array<{ title: string; url: string; pubDate: string }> = [];
      if (newsResponse.ok) {
        const newsJson = await newsResponse.json();
        newsData = { results: newsJson.results || [], answer: newsJson.answer || '' };
        googleNews = newsJson.googleNews || [];
      }

      // Stap 3: Genereer hooks
      setLoadingStep(3);
      const generateResponse = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteContent,
          newsData,
          googleNews,
          companyName,
          sector: sector || undefined,
        }),
      });

      setLoadingStep(4);

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        throw new Error(errorData.error || 'Kon hooks niet genereren');
      }

      const generateData = await generateResponse.json();
      
      if (generateData.hooks && generateData.hooks.length > 0) {
        setHooks(generateData.hooks);
        setUsedFallback(fallbackUsed);
        setGenerationContext({
          websiteContent,
          newsData,
          companyName,
          sector: sector || undefined,
        });
      } else {
        setError('Geen hooks gegenereerd. Probeer het opnieuw.');
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Er is een onverwachte fout opgetreden');
    } finally {
      setIsLoading(false);
      setLoadingStep(0);
    }
  };

  const handleContentTypeClick = async (hook: Hook, hookIndex: number, type: ContentType) => {
    setActiveContentType((prev) => ({ ...prev, [hookIndex]: type }));

    const key = contentKey(hookIndex, type);

    // Al gegenereerd? Alleen tonen, niet opnieuw ophalen.
    if (generatedContent[key]) {
      return;
    }

    if (!generationContext) {
      setContentErrors((prev) => ({
        ...prev,
        [key]: 'Context ontbreekt. Start opnieuw een zoekopdracht.',
      }));
      return;
    }

    setContentLoading((prev) => ({ ...prev, [key]: true }));
    setContentErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    try {
      const response = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          hook: hook.hook,
          explanation: hook.explanation,
          websiteContent: generationContext.websiteContent,
          newsData: generationContext.newsData,
          companyName: generationContext.companyName,
          sector: generationContext.sector,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Kon content niet genereren');
      }

      const data = await response.json();
      if (!data.content) {
        throw new Error('Lege respons van de server');
      }

      setGeneratedContent((prev) => ({ ...prev, [key]: data.content }));
    } catch (err) {
      console.error('Content generation error:', err);
      setContentErrors((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : 'Onverwachte fout',
      }));
    } finally {
      setContentLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const copyContent = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setContentCopied(key);
      setTimeout(() => setContentCopied(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const copyAllHooks = async () => {
    const allText = hooks
      .map((h, i) => `${i + 1}. ${h.hook}\n\n${h.explanation}`)
      .join('\n\n---\n\n');
    
    try {
      await navigator.clipboard.writeText(allText);
      setCopiedIndex(-1);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#202020' }}>
      {/* Gradient Navbar */}
      <nav
        className="flex items-center px-6"
        style={{
          height: '72px',
          background: 'linear-gradient(90deg, #0e6eff, #7b61ff 35%, #ddb3ff 65%, #e8a0bf)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://newfound.agency/wp-content/uploads/2025/06/Logo_newfound.svg"
          alt="Newfound"
          style={{ height: '20px' }}
        />
      </nav>

      {/* Header */}
      <header className="max-w-4xl mx-auto px-4 pt-12 pb-8 text-center">
        <h1
          className="text-5xl md:text-6xl uppercase tracking-wide mb-4"
          style={{ fontFamily: 'GreedCondensed, sans-serif', fontWeight: 700 }}
        >
          HOOKFINDER
        </h1>
        <p
          className="max-w-2xl mx-auto"
          style={{ fontFamily: 'KansasNew, serif', fontWeight: 500, color: '#fff', fontSize: '20px', lineHeight: '1.4', marginBottom: '8px' }}
        >
          Wat maakt jouw merk vandaag nieuwswaardig?
        </p>
        <p
          className="max-w-2xl mx-auto"
          style={{ fontFamily: 'Satoshi, sans-serif', color: 'rgba(255,255,255,0.6)', fontSize: '15px', lineHeight: '1.5', marginBottom: '6px' }}
        >
          Vind de haak en schrijf er direct een persbericht, LinkedIn-post, pitchmail of nieuwsbriefintro mee.
        </p>
        <p
          style={{ fontFamily: 'Satoshi, sans-serif', color: 'rgba(255,255,255,0.4)', fontSize: '13px', lineHeight: '1.4' }}
        >
          Voor PR-bureaus en communicatieteams
        </p>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Input Section */}
        <div className="rounded-2xl p-8 mb-8" style={{ background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)' }}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="input"
                className="block text-sm font-medium text-white/80 mb-2"
              >
                URL of bedrijfsnaam <span style={{ color: '#ddb3ff' }}>*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Globe className="h-5 w-5" style={{ color: '#ddb3ff' }} />
                </div>
                <input
                  type="text"
                  id="input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="https://voorbeeld.nl of Bedrijfsnaam"
                  className="block w-full pl-12 pr-4 py-4 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                  style={{ background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.3)', focusRingColor: '#0e6eff' } as React.CSSProperties}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="sector"
                className="block text-sm font-medium text-white/80 mb-2"
              >
                Thema of invalshoek <span className="text-white/40 font-normal">(optioneel)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Newspaper className="h-5 w-5" style={{ color: '#ddb3ff' }} />
                </div>
                <input
                  type="text"
                  id="sector"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  placeholder="bijv. duurzaamheid, gelijkwaardigheid, sport, klimaat, innovatie"
                  className="block w-full pl-12 pr-4 py-4 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                  style={{ background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.3)' }}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="lang" className="block text-sm font-medium text-white/80 mb-2">Bronnen</label>
                <select
                  id="lang"
                  value={lang}
                  onChange={(e) => setLang(e.target.value as LangFilter)}
                  disabled={isLoading}
                  className="block w-full px-4 py-3 text-white focus:outline-none focus:ring-2 focus:border-transparent transition-all disabled:opacity-60"
                  style={{ background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px' }}
                >
                  <option value="international">Internationaal</option>
                  <option value="nl">Alleen Nederland</option>
                  <option value="en">Alleen Engels</option>
                </select>
              </div>

              <div>
                <label htmlFor="period" className="block text-sm font-medium text-white/80 mb-2">Periode</label>
                <select
                  id="period"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
                  disabled={isLoading}
                  className="block w-full px-4 py-3 text-white focus:outline-none focus:ring-2 focus:border-transparent transition-all disabled:opacity-60"
                  style={{ background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px' }}
                >
                  <option value="week">Afgelopen week</option>
                  <option value="day">Afgelopen 24 uur</option>
                  <option value="month">Afgelopen maand</option>
                </select>
              </div>

              <div>
                <label htmlFor="mediaType" className="block text-sm font-medium text-white/80 mb-2">Type bronnen</label>
                <select
                  id="mediaType"
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value as MediaTypeFilter)}
                  disabled={isLoading}
                  className="block w-full px-4 py-3 text-white focus:outline-none focus:ring-2 focus:border-transparent transition-all disabled:opacity-60"
                  style={{ background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px' }}
                >
                  <option value="all">Alle bronnen</option>
                  <option value="vakbladen">Vakbladen</option>
                  <option value="dagbladen">Dagbladen & nieuwssites</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-white uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: isLoading ? '#555' : '#0e6eff',
                fontFamily: 'GreedCondensed, sans-serif',
                fontWeight: 700,
                fontSize: '1.1rem',
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Bezig...</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  <span>Vind mijn hooks</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="rounded-2xl p-8 mb-8" style={{ background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex flex-col items-center">
              <div className="relative w-16 h-16 mb-6">
                <div className="absolute inset-0 border-4 rounded-full" style={{ borderColor: 'rgba(221,179,255,0.2)' }}></div>
                <div
                  className="absolute inset-0 border-4 rounded-full border-t-transparent animate-spin"
                  style={{ borderColor: '#ddb3ff', borderTopColor: 'transparent' }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-semibold" style={{ color: '#ddb3ff' }}>
                    {loadingStep + 1}/5
                  </span>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-white mb-2">
                {loadingMessages[loadingStep]?.message || 'Bezig...'}
              </h3>

              <p className="text-white/50 text-center max-w-md">
                We analyseren de website, verzamelen actueel nieuws en ontwikkelen
                PR-strategieën specifiek voor dit merk.
              </p>

              <div className="flex gap-2 mt-6">
                {loadingMessages.map((_, index) => (
                  <div
                    key={index}
                    className="w-2 h-2 rounded-full transition-colors"
                    style={{ background: index <= loadingStep ? '#ddb3ff' : 'rgba(255,255,255,0.15)' }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {hooks.length > 0 && !isLoading && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  5 PR-hooks gevonden
                </h2>
                {usedFallback && (
                  <p className="text-sm mt-1" style={{ color: '#ddb3ff' }}>
                    Website kon niet worden gescraped. Resultaten gebaseerd op nieuws en bedrijfsnaam.
                  </p>
                )}
              </div>
              <button
                onClick={copyAllHooks}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium text-white/70 hover:text-white"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                {copiedIndex === -1 ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Gekopieerd!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Kopieer alles</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-4">
              {hooks.map((hook, index) => (
                <div
                  key={index}
                  className="rounded-xl p-6 transition-all"
                  style={{ background: '#f8f8f8', border: '1px solid rgba(0,0,0,0.06)' }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                      style={{ background: 'rgba(221,179,255,0.25)', color: '#c48bff' }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold mb-3 leading-relaxed" style={{ color: '#1a1a1a' }}>
                        {hook.hook}
                      </h3>
                      <p className="text-sm leading-relaxed mb-4" style={{ color: '#333333' }}>
                        {hook.explanation}
                      </p>

                      {hook.sources && hook.sources.length > 0 && (
                        <div className="mb-4">
                          <p className="font-semibold uppercase tracking-wide mb-2" style={{ color: '#999999', fontSize: '11px' }}>
                            Bronnen
                          </p>
                          <ul className="space-y-1">
                            {hook.sources.slice(0, 3).map((source, sIdx) => (
                              <li key={sIdx}>
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-start gap-1.5 hover:underline"
                                  style={{ color: '#555555', fontSize: '13px' }}
                                >
                                  <ExternalLink className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                  <span className="break-words">{source.title}</span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <button
                          onClick={() => copyToClipboard(
                            `${hook.hook}\n\n${hook.explanation}`,
                            index
                          )}
                          className="flex items-center gap-2 text-sm font-medium"
                          style={{ color: 'rgba(26,26,26,0.5)' }}
                        >
                          {copiedIndex === index ? (
                            <>
                              <Check className="w-4 h-4" />
                              <span>Gekopieerd!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>Kopieer hook</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'rgba(26,26,26,0.4)' }}>
                          Maak content van deze hook
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {CONTENT_TYPES.map((ct) => {
                            const key = contentKey(index, ct.id);
                            const isActive = activeContentType[index] === ct.id;
                            const isLoadingType = contentLoading[key];
                            const Icon = ct.icon;
                            return (
                              <button
                                key={ct.id}
                                onClick={() => handleContentTypeClick(hook, index, ct.id)}
                                disabled={isLoadingType}
                                className="btn-content-type flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                style={{
                                  background: isActive ? '#333333' : '#2a2a2a',
                                  color: '#fff',
                                  border: 'none',
                                }}
                              >
                                {isLoadingType ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Icon className="w-4 h-4" />
                                )}
                                <span>{ct.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {(() => {
                        const activeType = activeContentType[index];
                        if (!activeType) return null;
                        const key = contentKey(index, activeType);
                        const text = generatedContent[key];
                        const err = contentErrors[key];
                        const loadingType = contentLoading[key];
                        const def = CONTENT_TYPES.find((c) => c.id === activeType);
                        const ActiveIcon = def?.icon;

                        if (loadingType) {
                          return (
                            <div className="mt-4 p-4 rounded-lg flex items-center gap-3 text-sm" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', color: 'rgba(26,26,26,0.5)' }}>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>{def?.label} schrijven...</span>
                            </div>
                          );
                        }

                        if (err) {
                          return (
                            <div className="mt-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                              {err}
                            </div>
                          );
                        }

                        if (text) {
                          return (
                            <div className="mt-4 p-4 rounded-lg" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)' }}>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#1a1a1a' }}>
                                  {ActiveIcon && <ActiveIcon className="w-4 h-4" />}
                                  {def?.label}
                                </h4>
                                <button
                                  onClick={() => copyContent(text, key)}
                                  className="flex items-center gap-2 text-xs font-medium"
                                  style={{ color: '#ddb3ff' }}
                                >
                                  {contentCopied === key ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Gekopieerd!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>Kopieer</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <div className="font-sans text-sm leading-relaxed" style={{ color: 'rgba(26,26,26,0.75)' }}>
                                {text.split('\n').map((line, i) => {
                                  const trimmed = line.trim();
                                  const isLabel = trimmed.length > 0 && trimmed === trimmed.toUpperCase() && /^[A-Z\s\-]+$/.test(trimmed);
                                  if (isLabel) {
                                    return (
                                      <p key={i} className="uppercase mt-4 mb-1" style={{ fontSize: '10px', color: '#999999', letterSpacing: '0.05em' }}>
                                        {trimmed}
                                      </p>
                                    );
                                  }
                                  if (trimmed === '') {
                                    return <br key={i} />;
                                  }
                                  return <p key={i} className="mb-1">{line}</p>;
                                })}
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center pt-4">
              <button
                onClick={() => {
                  setHooks([]);
                  setInput('');
                  setSector('');
                  setError('');
                  setGenerationContext(null);
                  setGeneratedContent({});
                  setContentLoading({});
                  setContentErrors({});
                  setActiveContentType({});
                  setContentCopied(null);
                }}
                className="text-xs hover:underline"
                style={{ color: '#ddb3ff' }}
              >
                Nieuwe zoekopdracht starten
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <p className="text-center text-sm text-white/30">
            Een product van{' '}
            <a
              href="https://newfound.agency"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#ddb3ff' }}
              className="hover:underline"
            >
              Newfound
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
