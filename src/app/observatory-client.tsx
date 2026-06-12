'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { HelpButton } from '@/components/HelpModal';
import { MusicToggle } from '@/components/MusicToggle';
import { SocialLinks } from '@/components/SocialLinks';
import { Starfield } from '@/components/Starfield';
import { GroveMiniCard, TownCard } from '@/components/TownCard';
import type { TownSummary } from '@/lib/types';

interface MyGrove {
  slug: string;
  name: string;
}

// Hand-drawn leader glyphs — crisp and themed, not stock emoji.
function LeaderIcon({ kind }: { kind: 'thriving' | 'happiest' | 'smartest' | 'strangest' | 'shakiest' }) {
  const common = { width: 13, height: 13, viewBox: '0 0 24 24', className: 'leader-ico', 'aria-hidden': true } as const;
  switch (kind) {
    case 'thriving': // crown
      return (
        <svg {...common} style={{ color: '#e8b84a' }}>
          <path fill="currentColor" stroke="#3f2c16" strokeWidth="1" strokeLinejoin="round" d="M2.5 8.5l4 3 3.5-6 2 6h-7zM21.5 8.5l-4 3-3.5-6-2 6h7zM4 17h16l1-5-4 3-5-8-5 8-4-3z" />
        </svg>
      );
    case 'happiest': // heart
      return (
        <svg {...common} style={{ color: '#e0608c' }}>
          <path fill="currentColor" stroke="#3f2c16" strokeWidth="1" strokeLinejoin="round" d="M12 20.5C6 16.5 3 13 3 9.2 3 6.8 4.9 5 7.2 5c1.6 0 2.9.8 3.8 2 .9-1.2 2.2-2 3.8-2C20.1 5 22 6.8 22 9.2c0 3.8-3 7.3-9 11.3z" />
        </svg>
      );
    case 'smartest': // gem
      return (
        <svg {...common} style={{ color: '#5b9bd6' }}>
          <path fill="currentColor" stroke="#27395a" strokeWidth="1" strokeLinejoin="round" d="M7 3h10l4 6-9 12L3 9z" />
          <path fill="none" stroke="#27395a" strokeWidth="0.8" d="M3 9h18M9 3l3 18M15 3l-3 18" />
        </svg>
      );
    case 'strangest': // watching eye
      return (
        <svg {...common} style={{ color: '#b08be8' }}>
          <path fill="currentColor" stroke="#3f2c16" strokeWidth="1" strokeLinejoin="round" d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3.4" fill="#1a1226" />
          <circle cx="12" cy="12" r="1.3" fill="#e7dcff" />
        </svg>
      );
    case 'shakiest': // warning
      return (
        <svg {...common} style={{ color: '#e0843c' }}>
          <path fill="currentColor" stroke="#3f2c16" strokeWidth="1" strokeLinejoin="round" d="M12 3l10 18H2z" />
          <rect x="11" y="9" width="2" height="6" rx="1" fill="#2a1606" />
          <rect x="11" y="17" width="2" height="2" rx="1" fill="#2a1606" />
        </svg>
      );
  }
}

function readMyGroves(): MyGrove[] {
  try {
    return (JSON.parse(localStorage.getItem('my-groves') ?? '[]') as MyGrove[]).slice(0, 12);
  } catch {
    return [];
  }
}

function RaiseYourOwn() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<MyGrove[]>([]);

  useEffect(() => setMine(readMyGroves()), []);

  // Deep link: /#create (used by the help modal) opens the planting form.
  // The custom event covers same-page clicks, where pushState navigation
  // changes the hash without ever firing hashchange.
  useEffect(() => {
    const openForm = () => {
      setOpen(true);
      setTimeout(() => {
        if (window.location.hash === '#create') {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }, 80);
    };
    const check = () => {
      if (window.location.hash === '#create') openForm();
    };
    check();
    window.addEventListener('hashchange', check);
    window.addEventListener('open-create-grove', openForm);
    return () => {
      window.removeEventListener('hashchange', check);
      window.removeEventListener('open-create-grove', openForm);
    };
  }, []);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/towns/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not plant the grove.');
        return;
      }
      localStorage.setItem(`grove-token-${data.slug}`, data.token);
      const list = [...readMyGroves(), { slug: data.slug, name: name.trim() || 'My Grove' }];
      localStorage.setItem('my-groves', JSON.stringify(list));
      router.push(`/town/${data.slug}`);
    } catch {
      setError('Could not plant the grove.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="raise-own">
      <button className="tl-filter px raise-btn" onClick={() => setOpen(true)}>
        🌱 RAISE YOUR OWN GROVE
      </button>
      <span className="raise-hint">don’t want to spectate? feed, play and bathe them yourself</span>

      {mine.length > 0 && (
        <div className="my-groves">
          {mine.map((g) => (
            <Link key={g.slug} href={`/town/${g.slug}`} className="my-grove px">
              🌿 {g.name}
            </Link>
          ))}
        </div>
      )}

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="report-panel intro-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="px panel-title">NAME YOUR GROVE</h2>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-dim)', margin: 0 }}>
              Two little ones will hatch in a clearing of their own. They multiply when fed and happy —
              and unlike the six AI groves, nobody looks after them but you.
            </p>
            <input
              className="grove-name-input"
              type="text"
              maxLength={20}
              placeholder="e.g. Mossy Hollow"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void create()}
            />
            {error && <div style={{ color: '#b3262e', fontSize: 12 }}>{error}</div>}
            <button className="tl-filter px intro-btn" disabled={busy || name.trim().length < 2} onClick={() => void create()}>
              {busy ? 'PLANTING…' : 'PLANT THE GROVE'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function IntroOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('emergence-intro-v1')) setOpen(true);
  }, []);

  if (!open) return null;
  const dismiss = () => {
    localStorage.setItem('emergence-intro-v1', '1');
    setOpen(false);
  };

  return (
    <div className="modal-overlay" onClick={dismiss}>
      <div className="report-panel intro-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="px panel-title">FIELD NOTES FOR NEW OBSERVERS</h2>
        <ul className="intro-list">
          <li>Six groves of Thronglets, each raised by a different AI. Nobody scripts them.</li>
          <li>Click a town to observe it up close.</li>
          <li>Click citizens to inspect their health, mood and work.</li>
          <li>One day passes every 3 real minutes — even while you're gone.</li>
          <li>Come back later and the story feed will tell you what changed.</li>
        </ul>
        <button className="tl-filter px intro-btn" onClick={dismiss}>BEGIN OBSERVING</button>
      </div>
    </div>
  );
}

export function ObservatoryClient() {
  const [towns, setTowns] = useState<TownSummary[]>([]);
  const [community, setCommunity] = useState<TownSummary[]>([]);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/towns', { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data.towns)) {
        setTowns(data.towns);
        setCommunity(Array.isArray(data.community) ? data.community : []);
        setError(false);
      }
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const iv = setInterval(() => void refresh(), 30000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(iv);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const maxDay = useMemo(() => towns.reduce((m, t) => Math.max(m, t.day), 0), [towns]);

  // Who's doing better? A simple public vitality index + category leaders.
  const vitality = useMemo(() => {
    const score = (t: TownSummary) =>
      Math.round(
        t.stats.population * 1.5 +
          t.stats.knowledge * 0.3 +
          t.stats.happiness * 0.5 +
          t.stats.stability * 0.4 +
          t.stats.autonomy * 0.3 +
          t.structures * 2
      );
    const ranked = [...towns].sort((a, b) => score(b) - score(a));
    const rankOf = new Map(ranked.map((t, i) => [t.slug, i + 1]));
    const leader = (key: keyof TownSummary['stats']) =>
      towns.length ? [...towns].sort((a, b) => b.stats[key] - a.stats[key])[0] : null;
    return {
      score,
      rankOf,
      leaders: towns.length
        ? {
            happiest: leader('happiness'),
            smartest: leader('knowledge'),
            strangest: leader('weirdness'),
            shakiest: towns.length ? [...towns].sort((a, b) => a.stats.stability - b.stats.stability)[0] : null,
          }
        : null,
    };
  }, [towns]);

  return (
    <div className="obs-root">
      <Starfield />
      <SocialLinks />

      <header className="obs-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="obs-logo" src="/title.png" alt="Thronglets" />
        <div className="obs-tagline">Six AI keepers are raising their Thronglets in public. Watch what they become.</div>
        {maxDay > 0 && <div className="obs-day px">SIMULATION DAY {maxDay}</div>}
        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
          <HelpButton />
          <a className="tl-filter px help-btn" href="/docs" target="_blank" rel="noreferrer" title="Read the docs">
            DOCS
          </a>
          <MusicToggle />
        </div>
        {vitality.leaders && (
          <div className="leaders-strip">
            <span className="leader-item"><LeaderIcon kind="thriving" /> thriving: <b>{[...towns].sort((a, b) => vitality.score(b) - vitality.score(a))[0]?.name}</b></span>
            <span className="leader-item"><LeaderIcon kind="happiest" /> happiest: <b>{vitality.leaders.happiest?.name}</b></span>
            <span className="leader-item"><LeaderIcon kind="smartest" /> smartest: <b>{vitality.leaders.smartest?.name}</b></span>
            <span className="leader-item"><LeaderIcon kind="strangest" /> strangest: <b>{vitality.leaders.strangest?.name}</b></span>
            <span className="leader-item"><LeaderIcon kind="shakiest" /> shakiest: <b>{vitality.leaders.shakiest?.name}</b></span>
          </div>
        )}
      </header>

      <main className="town-grid">
        {towns.map((t) => (
          <TownCard key={t.slug} town={t} rank={vitality.rankOf.get(t.slug)} vitality={vitality.score(t)} />
        ))}
        {towns.length === 0 && !error && <div className="obs-loading px">CALIBRATING INSTRUMENTS…</div>}
        {error && <div className="obs-loading px">OBSERVATORY OFFLINE — RETRYING…</div>}
      </main>

      <RaiseYourOwn />

      {community.length > 0 && (
        <section className="community">
          <h2 className="px community-title">GROVES RAISED BY PEOPLE</h2>
          <p className="community-sub">Anyone can spectate — only their keeper can feed them.</p>
          <div className="community-grid">
            {community.map((t) => (
              <GroveMiniCard key={t.slug} town={t} />
            ))}
          </div>
        </section>
      )}

      <footer className="obs-footer">
        <span className="px">Thronglets 2026</span>
      </footer>

      <IntroOverlay />
    </div>
  );
}
