import Link from 'next/link';
import { ArrowLeft, Zap, Globe, FileText, CheckCircle, BookOpen, Layers, TrendingUp } from 'lucide-react';

export const metadata = {
  title: 'Hoe werkt HookFinder?',
  description: 'Technische uitleg over hoe HookFinder nieuwshaken vindt voor PR-bureaus.',
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="mb-10">
    <h2
      className="uppercase tracking-widest mb-5 pb-3"
      style={{
        fontFamily: 'GreedCondensed, sans-serif',
        fontWeight: 700,
        fontSize: '1rem',
        color: '#ddb3ff',
        borderBottom: '1px solid rgba(221,179,255,0.2)',
        letterSpacing: '0.12em',
      }}
    >
      {title}
    </h2>
    {children}
  </div>
);

const Source = ({
  icon: Icon,
  name,
  description,
}: {
  icon: React.ElementType;
  name: string;
  description: string;
}) => (
  <div
    className="flex items-start gap-4 p-4 rounded-xl"
    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
  >
    <div
      className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
      style={{ background: 'rgba(14,110,255,0.15)' }}
    >
      <Icon className="w-4 h-4" style={{ color: '#0e6eff' }} />
    </div>
    <div>
      <p className="font-medium text-white mb-0.5" style={{ fontFamily: 'KansasNew, serif', fontWeight: 500 }}>
        {name}
      </p>
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
        {description}
      </p>
    </div>
  </div>
);

const Principle = ({ name, description }: { name: string; description: string }) => (
  <div className="flex items-start gap-3">
    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#ddb3ff' }} />
    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
      <span className="text-white font-medium">{name}</span> {description}
    </p>
  </div>
);

const RoadmapItem = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3">
    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#ddb3ff' }} />
    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
      {label}
    </p>
  </div>
);

export default function HoeWerktHet() {
  return (
    <div className="min-h-screen" style={{ background: '#202020' }}>
      {/* Navbar */}
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

      <main className="max-w-2xl mx-auto px-4 py-12">
        {/* Terug-link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 mb-10 text-sm transition-colors hover:text-white"
          style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Satoshi, sans-serif' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Terug naar HookFinder
        </Link>

        {/* Header */}
        <header className="mb-12">
          <h1
            className="uppercase tracking-wide mb-4"
            style={{
              fontFamily: 'GreedCondensed, sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(2.5rem, 8vw, 4rem)',
              lineHeight: 1,
              color: '#fff',
            }}
          >
            HOE WERKT<br />HOOKFINDER?
          </h1>
          <p
            style={{
              fontFamily: 'KansasNew, serif',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.7)',
              fontSize: '1.1rem',
              lineHeight: 1.5,
            }}
          >
            HookFinder analyseert jouw klant en de sector om journalistieke haken te vinden.
          </p>
        </header>

        {/* Wat doen we */}
        <Section title="Wat doen we">
          <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
            We combineren drie bronnen om de sterkste nieuwshaken te vinden:
          </p>
          <div className="space-y-3">
            <Source
              icon={Globe}
              name="De website van jouw klant"
              description="Wat communiceren zij over zichzelf — merkpositie, thema's, doelgroep."
            />
            <Source
              icon={TrendingUp}
              name="Actuele nieuwsbronnen"
              description="Wat speelt er nu in hun sector — Tavily doorzoekt duizenden internationale bronnen in real-time."
            />
            <Source
              icon={FileText}
              name="Nederlandse media"
              description="Via Google News specifiek relevante ontwikkelingen in de Nederlandse pers."
            />
          </div>
          <p
            className="text-sm mt-5 p-4 rounded-xl"
            style={{
              color: 'rgba(255,255,255,0.6)',
              lineHeight: 1.7,
              background: 'rgba(221,179,255,0.06)',
              border: '1px solid rgba(221,179,255,0.15)',
            }}
          >
            Onze AI werkt als PR-strateeg en zoekt <span style={{ color: '#ddb3ff' }}>sectorale trends</span> waar jouw klant op kan reageren. Geen reclame over het merk, maar echte nieuwshaken.
          </p>
        </Section>

        {/* Bronnen */}
        <Section title="Welke bronnen gebruiken we">
          <div className="space-y-3">
            <Source
              icon={Zap}
              name="Tavily API"
              description="Real-time toegang tot duizenden internationale nieuwsbronnen."
            />
            <Source
              icon={Globe}
              name="Google News"
              description="Nederlandse nieuwsartikelen en regionale ontwikkelingen."
            />
            <Source
              icon={FileText}
              name="Jina AI"
              description="Website-inhoud van jouw klant voor merkcontext."
            />
          </div>
        </Section>

        {/* PR-methodieken */}
        <Section title="PR-methodieken">
          <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
            Elke hook wordt getoetst aan bewezen PR-principes:
          </p>
          <div className="space-y-4">
            <Principle
              name="Newsjacking"
              description="— het juiste moment om in te haken op actueel nieuws."
            />
            <Principle
              name="So What Test"
              description="— direct relevant voor journalisten, geen corporate boodschap."
            />
            <Principle
              name="Journalist-centraal"
              description="— geschreven vanuit media-perspectief, niet merkengeluid."
            />
          </div>
        </Section>

        {/* Roadmap V2 */}
        <Section title="V2 — Wat komt er aan">
          <div className="space-y-3">
            <RoadmapItem label="Perplexity integratie — diepere trends en context-analyse" />
            <RoadmapItem label="NewsAPI — directe toegang tot Nederlandse vakbladen" />
            <RoadmapItem label="Bronvalidatie — elke hook gekoppeld aan verificeerbare bron" />
            <RoadmapItem label="Content-types — directe export naar persbericht, LinkedIn, pitch-mail" />
          </div>
        </Section>

        {/* Roadmap V3 */}
        <Section title="V3 — Toekomstvisie">
          <div className="space-y-3">
            <RoadmapItem label="Trending dashboard — wekelijks overzicht per sector" />
            <RoadmapItem label="Sentiment analyse — social media monitoring van jouw klanten" />
            <RoadmapItem label="Concurrent tracking — wat communiceert de concurrentie" />
            <RoadmapItem label="Waybetter koppeling — van hook naar volledige campagne" />
          </div>
        </Section>

        {/* Waarom anders */}
        <Section title="Waarom HookFinder anders is">
          <div
            className="p-5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-start gap-3 mb-4">
              <Layers className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#ddb3ff' }} />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
                Andere tools monitoren nieuws of maken persberichten. Wij vinden{' '}
                <span style={{ color: '#fff', fontFamily: 'KansasNew, serif', fontWeight: 500 }}>de nieuwshaak</span>{' '}
                waar jouw klant bij past. Van reactief naar proactief.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#0e6eff' }} />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
                Elke hook heeft een verificeerbare externe bron. Geen hallucinaties, geen oncontroleerbare claims.
              </p>
            </div>
          </div>
        </Section>

        {/* Contact */}
        <div
          className="mt-4 p-6 rounded-xl text-center"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Vragen of feedback?
          </p>
          <a
            href="mailto:hello@newfound.agency"
            className="transition-colors hover:text-white"
            style={{
              fontFamily: 'KansasNew, serif',
              fontWeight: 500,
              color: '#ddb3ff',
              fontSize: '1rem',
            }}
          >
            hello@newfound.agency
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
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
