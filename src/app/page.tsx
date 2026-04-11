'use client';

import { useState } from 'react';
import { Search, Copy, Check, Sparkles, Newspaper, Globe, Loader2, FileText, Megaphone, Mail, Link2, ExternalLink } from 'lucide-react';

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
          sector: sector || undefined 
        }),
      });

      let newsData: NewsData = { results: [], answer: '' };
      if (newsResponse.ok) {
        newsData = await newsResponse.json();
      }

      // Stap 3: Genereer hooks
      setLoadingStep(3);
      const generateResponse = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteContent,
          newsData,
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">HookFinder</h1>
              <p className="text-sm text-slate-500">PR-hooks generator voor bureaus</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Input Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label 
                htmlFor="input" 
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                URL of bedrijfsnaam <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Globe className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  id="input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="https://voorbeeld.nl of Bedrijfsnaam"
                  className="block w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label 
                htmlFor="sector" 
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Thema of invalshoek <span className="text-slate-400 font-normal">(optioneel)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Newspaper className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  id="sector"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  placeholder="bijv. duurzaamheid, gelijkwaardigheid, sport, klimaat, innovatie"
                  className="block w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  disabled={isLoading}
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-8">
            <div className="flex flex-col items-center">
              <div className="relative w-16 h-16 mb-6">
                <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                <div 
                  className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"
                ></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-semibold text-indigo-600">
                    {loadingStep + 1}/5
                  </span>
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {loadingMessages[loadingStep]?.message || 'Bezig...'}
              </h3>
              
              <p className="text-slate-500 text-center max-w-md">
                We analyseren de website, verzamelen actueel nieuws en ontwikkelen 
                PR-strategieën specifiek voor dit merk.
              </p>

              <div className="flex gap-2 mt-6">
                {loadingMessages.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index <= loadingStep ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
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
                <h2 className="text-xl font-bold text-slate-900">
                  5 PR-hooks gevonden
                </h2>
                {usedFallback && (
                  <p className="text-sm text-amber-600 mt-1">
                    Website kon niet worden gescraped. Resultaten gebaseerd op nieuws en bedrijfsnaam.
                  </p>
                )}
              </div>
              <button
                onClick={copyAllHooks}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm font-medium"
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
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-slate-900 mb-3 leading-relaxed">
                        {hook.hook}
                      </h3>
                      <p className="text-slate-600 text-sm leading-relaxed mb-4">
                        {hook.explanation}
                      </p>

                      {hook.sources && hook.sources.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                            Bronnen
                          </p>
                          <ul className="space-y-1">
                            {hook.sources.slice(0, 3).map((source, sIdx) => (
                              <li key={sIdx}>
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-start gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
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
                          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 font-medium"
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

                      <div className="border-t border-slate-100 pt-4">
                        <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">
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
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                                  isActive
                                    ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                } disabled:opacity-60 disabled:cursor-not-allowed`}
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
                            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3 text-sm text-slate-600">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>{def?.label} schrijven...</span>
                            </div>
                          );
                        }

                        if (err) {
                          return (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                              {err}
                            </div>
                          );
                        }

                        if (text) {
                          return (
                            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                  {ActiveIcon && <ActiveIcon className="w-4 h-4" />}
                                  {def?.label}
                                </h4>
                                <button
                                  onClick={() => copyContent(text, key)}
                                  className="flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
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
                              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">
                                {text}
                              </pre>
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
                className="text-slate-500 hover:text-slate-700 text-sm font-medium"
              >
                Nieuwe zoekopdracht starten
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-16">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <p className="text-center text-sm text-slate-400">
            Product van{' '}
            <a
              href="https://newfound.agency"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Newfound
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
