'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CitizenPortrait } from '@/components/CitizenPortrait';
import { HelpButton } from '@/components/HelpModal';
import { MusicToggle } from '@/components/MusicToggle';
import { Starfield } from '@/components/Starfield';
import type { ObserverApi } from '@/game/ObserverScene';
import type { EvaluatedQuest } from '@/lib/quests';
import { observeTown, type ObserveHandle } from '@/lib/realtime-client';
import type {
  AgentSnapshot,
  Buildings,
  CareAction,
  Chatter,
  KeeperPublic,
  Placement,
  TownDetail,
  TownEvent,
  TownSummary,
} from '@/lib/types';

const ObserverCanvas = dynamic(() => import('@/game/ObserverCanvas'), { ssr: false });

// ── Labels ───────────────────────────────────────────────────────────

/** color = bright dot (any background) · text = readable ink on parchment */
const TASK_META: Record<AgentSnapshot['task'], { label: string; color: string; text: string }> = {
  confront: { label: 'confronting the keeper', color: '#ff5d8f', text: '#b3264f' },
  farm: { label: 'farming', color: '#8fd14f', text: '#3e7a1f' },
  maintain: { label: 'maintaining', color: '#f5d76e', text: '#8a6d0f' },
  research: { label: 'researching', color: '#6ec6f5', text: '#1f6e8a' },
  social: { label: 'socializing', color: '#f4f4f4', text: '#4a3520' },
  eat: { label: 'eating', color: '#a7f070', text: '#3e7a1f' },
  rest: { label: 'resting', color: '#9fb3d9', text: '#4a5a8a' },
  protest: { label: 'protesting', color: '#ff6b6b', text: '#b3262e' },
  ritual: { label: 'in ritual', color: '#c7a6ff', text: '#6d3fb8' },
  transmit: { label: 'at the mast', color: '#d36ad3', text: '#8a2c8a' },
  idle: { label: 'idle', color: '#8b93ad', text: '#7a6a4f' },
};

const BUILDING_LABELS: Array<[keyof Buildings, string]> = [
  ['house', 'dwellings'],
  ['farm', 'farms'],
  ['generator', 'generators'],
  ['lab', 'labs'],
  ['archive', 'archives'],
  ['market', 'markets'],
  ['shrine', 'shrines'],
  ['tower', 'masts'],
];

type Filter = 'all' | 'beats' | 'talk' | 'life' | 'care' | 'whispers';

const FILTERS: Array<[Filter, string]> = [
  ['all', 'ALL'],
  ['beats', 'MAJOR'],
  ['talk', 'TALK'],
  ['life', 'LIFE'],
  ['care', 'CARE'],
  ['whispers', 'WHISPERS'],
];

function matchesFilter(e: TownEvent, f: Filter): boolean {
  switch (f) {
    case 'beats':
      return e.kind === 'beat' || e.kind === 'milestone';
    case 'talk':
      return e.kind === 'talk';
    case 'whispers':
      return e.kind === 'whisper';
    case 'life':
      return e.kind === 'life';
    case 'care':
      return e.kind === 'care';
    default:
      return true;
  }
}

const KIND_TAG: Record<TownEvent['kind'], string> = {
  beat: 'BEAT',
  milestone: 'BEAT',
  talk: 'TALK',
  life: 'LIFE',
  care: 'CARE',
  whisper: 'WHSPR',
  event: 'EVENT',
};

const CARE_BUTTONS: Array<{ action: CareAction; glyph: string; label: string }> = [
  { action: 'feed', glyph: '🍎', label: 'Feed' },
  { action: 'play', glyph: '⚽', label: 'Play' },
  { action: 'bathe', glyph: '🛁', label: 'Bathe' },
  { action: 'heal', glyph: '✚', label: 'Heal' },
  { action: 'soothe', glyph: '♪', label: 'Soothe' },
];

const CARE_GLYPH: Record<CareAction, string> = { feed: '🍎', play: '⚽', bathe: '🛁', heal: '✚', soothe: '♪' };

// ── Small pieces ─────────────────────────────────────────────────────

function Bar({ label, value, max = 100, color }: { label: string; value: number; max?: number; color: string }) {
  return (
    <div className="meter">
      <span className="meter-label">{label}</span>
      <span className="meter-track">
        <span className="meter-fill" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
      </span>
      <span className="meter-value">{Math.round(value)}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="report-panel">
      <h2 className="px panel-title">{title}</h2>
      {children}
    </section>
  );
}

const DIALOGUE_RE = /^(.+?): “(.+?)” — (.+?): “(.+?)”$/;

function TimelineEntry({ e, compact = false }: { e: TownEvent; compact?: boolean }) {
  const dialogue = e.kind === 'talk' ? DIALOGUE_RE.exec(e.text) : null;
  return (
    <div className={`tl-entry tl-${e.kind}${compact ? ' tl-compact' : ''}`}>
      <span className={`tl-tag tag-${e.kind} px`}>{KIND_TAG[e.kind]}</span>
      <span className="tl-day px">D{e.tick}</span>
      {dialogue ? (
        <span className="tl-text tl-dialogue">
          <span className="tl-line"><b>{dialogue[1]}</b> “{dialogue[2]}”</span>
          <span className="tl-line"><b>{dialogue[3]}</b> “{dialogue[4]}”</span>
        </span>
      ) : (
        <span className="tl-text">{e.kind === 'whisper' ? `▓ ${e.text}` : e.text}</span>
      )}
    </div>
  );
}

interface Visit {
  id: number;
  day: number;
}

// ── Page ─────────────────────────────────────────────────────────────

export function ObserverClient({ slug }: { slug: string }) {
  const [town, setTown] = useState<TownDetail | null>(null);
  const [events, setEvents] = useState<TownEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [whisperBanner, setWhisperBanner] = useState<string | null>(null);
  const [observers, setObservers] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [lastVisit, setLastVisit] = useState<Visit | null>(null);
  const [showFullTimeline, setShowFullTimeline] = useState(false);
  const [tab, setTab] = useState<'town' | 'timeline' | 'status'>('town');
  const [ownerToken, setOwnerToken] = useState<string | null>(null);
  const [careBusy, setCareBusy] = useState(false);
  const [careNote, setCareNote] = useState<string | null>(null);
  const [cooldowns, setCooldowns] = useState<Partial<Record<CareAction, number>>>({});
  const [showQuests, setShowQuests] = useState(false);
  const [claimBusy, setClaimBusy] = useState<string | null>(null);

  const apiRef = useRef<ObserverApi | null>(null);
  const lastIdRef = useRef(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<ObserveHandle | null>(null);

  // ── Initial load ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/towns/${slug}?watch=1`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.town) {
          setError(data.error || 'No such town.');
          return;
        }
        const t = data.town as TownDetail;
        setTown(t);
        setEvents(t.events);
        lastIdRef.current = t.events.length ? t.events[t.events.length - 1].id : 0;

        const key = `visit-${slug}`;
        try {
          const prev = JSON.parse(localStorage.getItem(key) ?? 'null') as Visit | null;
          if (prev && prev.id > 0) setLastVisit(prev);
        } catch { /* first visit */ }
        localStorage.setItem(key, JSON.stringify({ id: lastIdRef.current, day: t.day }));

        setCooldowns(t.careCooldowns ?? {});
        if (t.isPlayer) setOwnerToken(localStorage.getItem(`grove-token-${slug}`));
      })
      .catch(() => !cancelled && setError('Observatory offline.'));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // ── Live polling ───────────────────────────────────────────────────
  useEffect(() => {
    if (!town) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/towns/${slug}?after=${lastIdRef.current}`, { cache: 'no-store' });
        const raw = (await res.json()) as { town?: TownDetail } & {
          town: TownSummary;
          buildings: Buildings;
          placements: Placement[];
          agents: AgentSnapshot[];
          chatter: Chatter[];
          keeper: KeeperPublic | null;
          careCooldowns: Partial<Record<CareAction, number>>;
          summaryText: string;
          coins?: number;
          quests?: EvaluatedQuest[];
          events: TownEvent[];
        };
        if (!raw.town) return;
        // With no events yet (a freshly planted grove), after=0 returns the
        // full-detail shape — normalize it to the flat poll shape.
        const detail = raw.agents ? null : (raw.town as TownDetail);
        const data = detail
          ? {
              town: detail as TownSummary,
              buildings: detail.buildings,
              placements: detail.placements,
              agents: detail.agents,
              chatter: detail.chatter,
              keeper: detail.keeper,
              careCooldowns: detail.careCooldowns,
              summaryText: detail.summaryText,
              coins: detail.coins,
              quests: detail.quests,
              events: detail.events.filter((e) => e.id > lastIdRef.current),
            }
          : raw;
        setTown((cur) =>
          cur
            ? {
                ...cur,
                ...data.town,
                buildings: data.buildings,
                placements: data.placements,
                agents: data.agents,
                chatter: data.chatter,
                keeper: data.keeper,
                summaryText: data.summaryText,
                coins: data.coins ?? cur.coins,
                quests: data.quests ?? cur.quests,
              }
            : cur
        );
        setCooldowns(data.careCooldowns ?? {});
        apiRef.current?.applyTown(data.town, data.placements, data.agents, data.chatter, data.keeper);
        for (const e of data.events.filter((ev) => ev.kind === 'care').slice(0, 2)) {
          apiRef.current?.careBurst(e.text.slice(0, 2).trim() || '✚');
        }
        if (data.events.length) {
          lastIdRef.current = data.events[data.events.length - 1].id;
          localStorage.setItem(`visit-${slug}`, JSON.stringify({ id: lastIdRef.current, day: data.town.day }));
          setEvents((cur) => [...cur, ...data.events].slice(-250));
          const whisper = data.events.find((e) => e.kind === 'whisper');
          if (whisper) {
            setWhisperBanner(whisper.text);
            apiRef.current?.flashWhisper();
            setTimeout(() => setWhisperBanner(null), 9000);
          }
        }
      } catch { /* transient */ }
    }, 10000);
    return () => clearInterval(iv);
  }, [town?.slug, slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Presence ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!town) return;
    const room = observeTown(slug, setObservers);
    roomRef.current = room;
    return () => {
      room.dispose();
      roomRef.current = null;
    };
  }, [town?.slug, slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only stick to the bottom if the reader is already there — never yank
  // the scroll position away from someone reading history.
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [events]);
  useEffect(() => {
    const el = timelineRef.current;
    if (el) el.scrollTop = el.scrollHeight; // filter switch: jump to newest
  }, [filter]);

  const onSceneReady = useCallback((api: ObserverApi) => {
    apiRef.current = api;
  }, []);

  // Tick down the care cooldowns client-side.
  useEffect(() => {
    const iv = setInterval(() => {
      setCooldowns((cur) => {
        const next: typeof cur = {};
        for (const [k, v] of Object.entries(cur)) {
          if ((v as number) > 1) next[k as CareAction] = (v as number) - 1;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const doCare = useCallback(
    async (action: CareAction) => {
      if (!ownerToken || careBusy) return;
      setCareBusy(true);
      try {
        const res = await fetch(`/api/towns/${slug}/care`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Owner-Token': ownerToken },
          body: JSON.stringify({ action }),
        });
        const data = await res.json();
        if (!res.ok) {
          setCareNote(data.error ?? 'That did not work.');
        } else {
          setCareNote(data.message);
          setCooldowns(data.careCooldowns ?? {});
          if (data.town && data.agents) {
            setTown((cur) =>
              cur ? { ...cur, ...data.town, agents: data.agents, coins: data.coins ?? cur.coins, quests: data.quests ?? cur.quests } : cur
            );
            apiRef.current?.applyTown(
              data.town,
              town?.placements ?? [],
              data.agents,
              town?.chatter ?? [],
              null
            );
          }
          apiRef.current?.careBurst(CARE_GLYPH[action]);
        }
      } catch {
        setCareNote('The grove did not respond.');
      } finally {
        setCareBusy(false);
        setTimeout(() => setCareNote(null), 3500);
      }
    },
    [ownerToken, careBusy, slug, town?.placements, town?.chatter]
  );

  const doClaim = useCallback(
    async (questId: string) => {
      if (!ownerToken || claimBusy) return;
      setClaimBusy(questId);
      try {
        const res = await fetch(`/api/towns/${slug}/quests/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Owner-Token': ownerToken },
          body: JSON.stringify({ questId }),
        });
        const data = await res.json();
        if (res.ok) {
          setTown((cur) => (cur ? { ...cur, coins: data.coins, quests: data.quests } : cur));
          setCareNote(`+${data.reward} coins`);
        } else {
          setCareNote(data.error ?? 'Could not claim that.');
        }
      } catch {
        setCareNote('The grove did not respond.');
      } finally {
        setClaimBusy(null);
        setTimeout(() => setCareNote(null), 3000);
      }
    },
    [ownerToken, claimBusy, slug]
  );

  const onAgentSelect = useCallback((id: number | null) => {
    setSelectedAgentId(id);
    if (id !== null) setTab('status');
  }, []);

  const selectedAgent = useMemo(
    () => town?.agents.find((a) => a.id === selectedAgentId) ?? null,
    [town?.agents, selectedAgentId]
  );
  const lastSpoken = useMemo(() => {
    if (!town || selectedAgentId === null) return null;
    for (let i = town.chatter.length - 1; i >= 0; i--) {
      const c = town.chatter[i];
      if (c.a === selectedAgentId) return c.la;
      if (c.b === selectedAgentId) return c.lb;
    }
    return null;
  }, [town, selectedAgentId]);

  const filtered = useMemo(() => events.filter((e) => matchesFilter(e, filter)), [events, filter]);

  const sinceVisit = useMemo(() => {
    if (!town) return null;
    const sinceId = lastVisit?.id ?? Number.MAX_SAFE_INTEGER;
    const fresh = events.filter((e) => e.id > sinceId);
    return {
      isFirst: lastVisit === null,
      daysPassed: lastVisit ? Math.max(0, town.day - lastVisit.day) : 0,
      lastDay: lastVisit?.day ?? town.day,
      events: fresh.length,
      beats: fresh.filter((e) => e.kind === 'beat' || e.kind === 'milestone').length,
      talk: fresh.filter((e) => e.kind === 'talk').length,
      life: fresh.filter((e) => e.kind === 'life').length,
    };
  }, [town, events, lastVisit]);

  if (error) {
    return (
      <div className="obs-root center-wrap">
        <Starfield />
        <div className="report-panel" style={{ padding: 24 }}>
          <p className="px">{error}</p>
          <Link className="obs-link px" href="/">← BACK TO OBSERVATORY</Link>
        </div>
      </div>
    );
  }

  if (!town) {
    return (
      <div className="obs-root center-wrap">
        <Starfield />
        <div className="px obs-loading">FOCUSING LENS…</div>
      </div>
    );
  }

  const timelineList = (compact: boolean) => (
    <>
      {filtered.map((e, i) => {
        const isFirstNew =
          lastVisit !== null && e.id > lastVisit.id && (i === 0 || filtered[i - 1].id <= lastVisit.id);
        return (
          <React.Fragment key={e.id}>
            {isFirstNew && <div className="tl-divider px">— SINCE YOUR LAST VISIT —</div>}
            <TimelineEntry e={e} compact={compact} />
          </React.Fragment>
        );
      })}
      {filtered.length === 0 && (
        <div className="tl-empty">Nothing recorded under this filter yet.</div>
      )}
    </>
  );

  return (
    <div className={`observer-root tab-${tab}`} style={{ ['--accent' as never]: town.accent }}>
      <Starfield />

      {/* ── LEFT: story feed / catch-up ── */}
      <aside className="observer-left">
        <Section title="CATCH-UP">
          {sinceVisit?.isFirst ? (
            <div className="catchup-first">
              First observation of {town.name}. Its recorded history starts below — Day {town.day} and counting.
            </div>
          ) : (
            <>
              <div className="catchup-grid">
                <div className="cu-cell"><span className="cu-num">{town.day}</span><span className="cu-label px">DAY NOW</span></div>
                <div className="cu-cell"><span className="cu-num">{sinceVisit?.lastDay}</span><span className="cu-label px">LAST SEEN</span></div>
                <div className="cu-cell"><span className="cu-num">{sinceVisit?.daysPassed}</span><span className="cu-label px">DAYS PASSED</span></div>
                <div className="cu-cell"><span className="cu-num">{sinceVisit?.events}</span><span className="cu-label px">NEW EVENTS</span></div>
                <div className="cu-cell"><span className="cu-num">{sinceVisit?.beats}</span><span className="cu-label px">NEW BEATS</span></div>
                <div className="cu-cell"><span className="cu-num">{(sinceVisit?.talk ?? 0) + (sinceVisit?.life ?? 0)}</span><span className="cu-label px">TALK+LIFE</span></div>
              </div>
              {sinceVisit?.events === 0 && (
                <div className="catchup-none">No new recorded events since your last visit.</div>
              )}
            </>
          )}
          {town.story.lastBeat && (
            <div className="catchup-beat">
              <span className="tl-tag tag-beat px">BEAT</span> {town.story.lastBeat}
            </div>
          )}
        </Section>

        <section className="report-panel timeline-panel">
          <div className="tl-head">
            <h2 className="px panel-title" style={{ border: 'none', padding: 0, margin: 0 }}>STORY FEED</h2>
            <button className="tl-filter px" onClick={() => setShowFullTimeline(true)}>FULL ⤢</button>
          </div>
          <div className="tl-filters">
            {FILTERS.map(([f, label]) => (
              <button key={f} className={`tl-filter px${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
                {label}
              </button>
            ))}
          </div>
          <div className="timeline" ref={timelineRef}>
            {timelineList(false)}
          </div>
        </section>
      </aside>

      {/* ── CENTER: the living town ── */}
      <div className="observer-stage">
        <ObserverCanvas key={town.slug} town={town} onReady={onSceneReady} onAgentSelect={onAgentSelect} />

        <div className="stage-topbar">
          <Link className="obs-link px" href="/">← OBSERVATORY</Link>
          <div className="stage-title">
            <span className="px stage-name">{town.name}</span>
            <span className="stage-culture">{town.culture} · {town.tagline}</span>
          </div>
          <div
            className="px stage-day"
            title="1 simulated day passes every 3 real minutes. Days 0–40 were pre-simulated as founding history."
          >
            DAY {town.day} · ERA {town.story.era}
            {observers !== null && observers > 0 && (
              <span className="observers-pill"> · {observers + 1} WATCHING</span>
            )}
          </div>
          <MusicToggle />
          <HelpButton compact />
        </div>

        {/* Care toolbar — only the grove's own keeper sees the buttons. */}
        {town.isPlayer && ownerToken && (
          <div className="care-bar">
            {CARE_BUTTONS.map(({ action, glyph, label }) => {
              const cd = cooldowns[action];
              return (
                <button
                  key={action}
                  className="care-btn"
                  disabled={careBusy || !!cd}
                  title={label}
                  onClick={() => void doCare(action)}
                >
                  <span className="care-glyph">{glyph}</span>
                  <span className="care-label px">{cd ? `${cd}s` : label.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        )}
        {town.isPlayer && !ownerToken && (
          <div className="care-bar care-bar-note">You are observing someone else’s grove.</div>
        )}

        {town.isPlayer && ownerToken && (
          <button className="quest-toggle px" onClick={() => setShowQuests(true)}>
            <span className="coin">◎</span> {town.coins ?? 0} · QUESTS
            {town.quests?.some((q) => q.done && !q.claimed) && <span className="quest-dot" />}
          </button>
        )}

        {careNote && <div className="care-note">{careNote}</div>}

        {showQuests && town.quests && (
          <div className="modal-overlay" onClick={() => setShowQuests(false)}>
            <div className="report-panel quest-card" onClick={(e) => e.stopPropagation()}>
              <div className="tl-head">
                <h2 className="px panel-title" style={{ border: 'none', padding: 0, margin: 0 }}>QUESTS</h2>
                <button className="ai-close" onClick={() => setShowQuests(false)}>✕</button>
              </div>
              <div className="quest-balance px"><span className="coin">◎</span> {town.coins ?? 0} coins</div>
              <div className="quest-list">
                {town.quests.map((q) => (
                  <div key={q.id} className={`quest-row${q.claimed ? ' done' : q.done ? ' ready' : ''}`}>
                    <div className="quest-main">
                      <div className="quest-title px">{q.title}</div>
                      <div className="quest-desc">{q.desc}</div>
                      <div className="quest-bar">
                        <span style={{ width: `${Math.min(100, Math.round((q.current / q.target) * 100))}%` }} />
                      </div>
                    </div>
                    <div className="quest-side">
                      <div className="quest-reward px"><span className="coin">◎</span>{q.reward}</div>
                      {q.claimed ? (
                        <span className="quest-state px claimed">CLAIMED</span>
                      ) : q.done ? (
                        <button className="quest-claim px" disabled={claimBusy === q.id} onClick={() => void doClaim(q.id)}>
                          {claimBusy === q.id ? '…' : 'CLAIM'}
                        </button>
                      ) : (
                        <span className="quest-state px">{q.current}/{q.target}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="quest-fine">Coins are an in-game currency for now — more uses coming. Only this grove’s keeper earns them.</p>
            </div>
          </div>
        )}

        {whisperBanner && (
          <div className="whisper-banner">
            <span className="whisper-text">▓ {whisperBanner}</span>
          </div>
        )}
      </div>

      {/* ── RIGHT: status + citizen ── */}
      <aside className="observer-side">
        <Section title="WHAT IS HAPPENING">
          <div className="story-summary">{town.summaryText}</div>
          <div className="kv-rows">
            <div className="kv"><span className="kv-k px">ARC</span><span className="kv-v">Era {town.story.era} · {town.story.stageName}</span></div>
            <div className="kv"><span className="kv-k px">TRAJECTORY</span><span className={`traj-chip traj-${town.story.trajectory}`}>{town.story.trajectory}</span></div>
            <div className="kv"><span className="kv-k px">TENSION</span><span className="kv-v">{town.story.conflict}</span></div>
            <div className="kv"><span className="kv-k px">MOOD</span><span className="kv-v kv-accent">{town.mood}</span></div>
          </div>
          <div className={`narrator-badge px${town.narrator?.enabled && !town.isPlayer ? ' live' : ''}`}>
            {town.isPlayer
              ? 'KEEPER: YOU — they are counting on you'
              : `KEEPER: ${town.keeper?.name ?? '?'}${town.narrator?.enabled ? ` · ${town.narrator.model} · LIVE` : ' · instinct only (no key)'}`}
            {town.keeper?.cornered ? ' · ⚠ SURROUNDED' : ''}
          </div>
          <div className="day-note">1 day ≈ 3 real minutes · days 0–40 are seeded founding history</div>
        </Section>

        <Section title="TOWN HEALTH">
          <Bar label="HAPPINESS" value={town.stats.happiness} color="#f59ab5" />
          <Bar label="STABILITY" value={town.stats.stability} color="#5b87c7" />
          <Bar label="AUTONOMY" value={town.stats.autonomy} color="#b08be8" />
          <Bar label="WEIRDNESS" value={town.stats.weirdness} color="#d36ad3" />
        </Section>

        <Section title="RESOURCES">
          <Bar label="POPULATION" value={town.stats.population} max={70} color="#e8e6d8" />
          <Bar label="FOOD" value={town.stats.food} max={500} color="#8fd14f" />
          <Bar label="ENERGY" value={town.stats.energy} max={500} color="#f5d76e" />
          <Bar label="COMPUTE" value={town.stats.compute} max={400} color="#6ec6f5" />
          <Bar label="KNOWLEDGE" value={town.stats.knowledge} max={999} color="#c7a6ff" />
        </Section>

        <Section title="CITIZEN ACTIVITY">
          <div className="task-chips">
            {Object.entries(
              town.agents.reduce<Record<string, number>>((acc, a) => {
                acc[a.task] = (acc[a.task] ?? 0) + 1;
                return acc;
              }, {})
            ).map(([task, n]) => (
              <span className="task-chip" key={task}>
                <span className="task-dot" style={{ background: TASK_META[task as AgentSnapshot['task']]?.color }} />
                {n} {TASK_META[task as AgentSnapshot['task']]?.label ?? task}
              </span>
            ))}
            {town.agents.length === 0 && <span className="tl-empty">no citizens visible</span>}
          </div>
        </Section>

        <Section title={`CITIZENS (${town.agents.length})`}>
          <div className="roster">
            {town.agents.map((a) => (
              <button
                key={a.id}
                className={`citizen-card${a.id === selectedAgentId ? ' selected' : ''}`}
                onClick={() => {
                  setSelectedAgentId(a.id);
                  apiRef.current?.focusAgent(a.id);
                }}
                title={`${a.name} · ${a.role} · ${TASK_META[a.task]?.label}`}
              >
                <CitizenPortrait role={a.role} />
                <span className="cc-body">
                  <span className="cc-name">{a.name}</span>
                  <span className="cc-task" style={{ color: TASK_META[a.task]?.text }}>
                    {TASK_META[a.task]?.label}
                  </span>
                  <span className="cc-bars">
                    <span className="cc-bar"><span style={{ width: `${a.health}%`, background: '#8fd14f' }} /></span>
                    <span className="cc-bar"><span style={{ width: `${a.mood}%`, background: '#f59ab5' }} /></span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="BUILDINGS">
          <div className="building-grid">
            {BUILDING_LABELS.filter(([k]) => town.buildings[k] > 0).map(([k, label]) => (
              <div className="bld" key={k}>
                <span className="bld-n">{town.buildings[k]}</span>
                <span className="bld-label">{label}</span>
              </div>
            ))}
            {BUILDING_LABELS.every(([k]) => town.buildings[k] === 0) && (
              <span className="tl-empty">no structures yet</span>
            )}
          </div>
        </Section>

        <Section title="SELECTED CITIZEN">
          {selectedAgent ? (
            <div className="char-sheet">
              <div className="cs-head">
                <div className="cs-portrait">
                  <CitizenPortrait role={selectedAgent.role} size={44} />
                </div>
                <div className="cs-id">
                  <span className="px cs-name">{selectedAgent.name}</span>
                  <span className="cs-vibe">{selectedAgent.vibe}</span>
                  <span className="cs-roleline">
                    {selectedAgent.role} · {selectedAgent.age} days old
                  </span>
                </div>
                <button className="ai-close" onClick={() => setSelectedAgentId(null)}>✕</button>
              </div>

              <div className="cs-likes">
                <div className="cs-like"><span className="cs-glyph">♥</span> {selectedAgent.likes}</div>
                <div className="cs-dislike"><span className="cs-glyph">✗</span> {selectedAgent.dislikes}</div>
              </div>

              <div className="kv-rows">
                <div className="kv">
                  <span className="kv-k px">DOING</span>
                  <span className="kv-v" style={{ color: TASK_META[selectedAgent.task]?.text }}>
                    {TASK_META[selectedAgent.task]?.label}
                    {Math.abs(selectedAgent.x - selectedAgent.tx) + Math.abs(selectedAgent.y - selectedAgent.ty) <= 1
                      ? ' (on site)'
                      : ` (heading to ${selectedAgent.tx}, ${selectedAgent.ty})`}
                  </span>
                </div>
              </div>
              <Bar label="HEALTH" value={selectedAgent.health} color="#5da93c" />
              <Bar label="MOOD" value={selectedAgent.mood} color="#d6608c" />
              <Bar label="NOURISH" value={selectedAgent.nourish} color="#c79a23" />
              <Bar label="ENERGY" value={selectedAgent.energy} color="#3d8fc4" />
              <Bar label="FUN" value={selectedAgent.fun} color="#c96f2e" />
              <Bar label="CLEAN" value={selectedAgent.clean} color="#3da9a0" />
              {lastSpoken && <div className="ai-quote">“{lastSpoken}”</div>}
            </div>
          ) : (
            <div className="tl-empty">Click a citizen on the map — or in the roster above — to read their sheet.</div>
          )}
        </Section>
      </aside>

      {/* ── Mobile tab bar ── */}
      <nav className="mobile-tabs">
        {(
          [
            ['town', 'TOWN'],
            ['timeline', 'TIMELINE'],
            ['status', 'STATUS'],
          ] as const
        ).map(([t, label]) => (
          <button key={t} className={`mtab px${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </nav>

      {/* ── Full timeline modal ── */}
      {showFullTimeline && (
        <div className="modal-overlay" onClick={() => setShowFullTimeline(false)}>
          <div className="full-timeline report-panel" onClick={(e) => e.stopPropagation()}>
            <div className="tl-head">
              <h2 className="px panel-title" style={{ border: 'none', padding: 0, margin: 0 }}>
                {town.name.toUpperCase()} — FULL RECORD
              </h2>
              <button className="ai-close" onClick={() => setShowFullTimeline(false)}>✕</button>
            </div>
            <div className="tl-filters">
              {FILTERS.map(([f, label]) => (
                <button key={f} className={`tl-filter px${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="timeline full">{timelineList(false)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
