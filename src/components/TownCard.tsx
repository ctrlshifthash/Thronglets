'use client';

import Link from 'next/link';
import React, { useEffect, useRef } from 'react';
import { drawWorldThumb } from '@/lib/thumb';
import type { TownSummary } from '@/lib/types';

function Meter({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="meter" title={`${label}: ${value}`}>
      <span className="meter-label">{label}</span>
      <span className="meter-track">
        <span className="meter-fill" style={{ width: `${Math.min(100, value)}%`, background: accent ?? '#5b87c7' }} />
      </span>
    </div>
  );
}

/** Tiny box for the community shelf — many groves, very little space each. */
export function GroveMiniCard({ town }: { town: TownSummary }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && town.tilemap) drawWorldThumb(canvasRef.current, town.tilemap);
  }, [town.tilemap]);

  return (
    <Link href={`/town/${town.slug}`} className="mini-card" style={{ ['--accent' as never]: town.accent }}>
      <div className="mini-thumb">
        <canvas ref={canvasRef} />
      </div>
      <div className="mini-name px">{town.name}</div>
      <div className="mini-line">DAY {town.day} · {town.stats.population} little ones</div>
      <div className="mini-line mini-dim">{town.mood} · ♥ {town.stats.happiness}</div>
    </Link>
  );
}

export function TownCard({ town, rank, vitality }: { town: TownSummary; rank?: number; vitality?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && town.tilemap) drawWorldThumb(canvasRef.current, town.tilemap);
  }, [town.tilemap]);

  const ev = town.latestEvent;

  return (
    <Link href={`/town/${town.slug}`} className="town-card" style={{ ['--accent' as never]: town.accent }}>
      <div className="tc-head">
        <div>
          <span className="tc-name px">
            {town.name}
            {rank === 1 && <span className="tc-crown"> 🏆</span>}
          </span>
          <span className="tc-culture">{town.culture}</span>
        </div>
        <div className="tc-corner">
          <span className="tc-day px">DAY {town.day}</span>
          {rank !== undefined && (
            <span className="tc-rank px" title={`Vitality index ${vitality}`}>#{rank} · {vitality}</span>
          )}
        </div>
      </div>

      <div className="tc-thumb">
        <canvas ref={canvasRef} />
      </div>

      <div className="tc-statline">
        <span className="tc-stage">{town.stage}</span>
        <span className="tc-pop">{town.stats.population} citizens · {town.mood}</span>
      </div>

      <div className="tc-arcline">
        <span className={`traj-chip traj-${town.story.trajectory}`}>{town.story.trajectory}</span>
        <span className="tc-arc">
          ERA {town.story.era} · {town.story.stageName}
        </span>
      </div>

      <div className="tc-meters">
        <Meter label="HAP" value={town.stats.happiness} accent="#d6608c" />
        <Meter label="STB" value={town.stats.stability} accent="#5b87c7" />
        <Meter label="AUT" value={town.stats.autonomy} accent="#b08be8" />
        <Meter label="WRD" value={town.stats.weirdness} accent="#d36ad3" />
      </div>

      <div className="tc-vitals">
        <span title="Food stock">🍎 {town.stats.food}</span>
        <span title="Energy stock">⚡ {town.stats.energy}</span>
        <span title="Knowledge">🧠 {town.stats.knowledge}</span>
        <span title="Structures">🏠 {town.structures}</span>
      </div>

      {town.story.lastBeat && <div className="tc-beat">★ {town.story.lastBeat}</div>}

      <div className={`tc-event${ev?.kind === 'whisper' ? ' whisper-text' : ''}`}>
        {ev ? (ev.kind === 'whisper' ? `▓ ${ev.text}` : ev.text) : 'Awaiting first transmission…'}
      </div>

      <div className="tc-observe px">OBSERVE →</div>
    </Link>
  );
}
