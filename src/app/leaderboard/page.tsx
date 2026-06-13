import type { Metadata } from 'next';
import Link from 'next/link';
import React from 'react';
import { leaderboardRows } from '@/lib/db';
import { LAMPORTS_PER_SOL } from '@/lib/rewards';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Leaderboard — Thronglets',
  description: 'The groves earning the most from the daily $THRONG reward pool.',
};

const shortWallet = (w: string) => (w ? `${w.slice(0, 4)}…${w.slice(-4)}` : '— unlinked');
const sol = (lamports: number) => {
  if (lamports <= 0) return '—';
  const v = lamports / LAMPORTS_PER_SOL;
  return v >= 1 ? v.toFixed(3) : v.toFixed(4);
};
const fmtCoins = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toString();

export default function LeaderboardPage() {
  const rows = leaderboardRows(50);

  return (
    <div className="dash-root">
      <header className="dash-topbar">
        <Link href="/" className="dash-brand px">THRONGLETS</Link>
        <nav className="dash-nav">
          <Link href="/" className="dash-link px">HOME</Link>
          <Link href="/dashboard" className="dash-link px">DASHBOARD</Link>
          <Link href="/docs" className="dash-link px">DOCS</Link>
        </nav>
      </header>

      <main className="dash-main">
        <p className="dash-eyebrow px">TOP EARNERS</p>
        <h1 className="dash-h1 px">Leaderboard</h1>
        <p className="dash-lede">
          The groves earning the most from the daily $THRONG reward pool — by real SOL claimed. Coins show how
          hard each grove is being played. Wallets are shortened for privacy.
        </p>

        {rows.length === 0 ? (
          <div className="lb-empty">No player groves yet — be the first to raise one.</div>
        ) : (
          <div className="lb-table">
            <div className="lb-head">
              <span>#</span>
              <span>Grove</span>
              <span>Keeper</span>
              <span className="lb-num">Coins</span>
              <span className="lb-num">Earned ◎</span>
            </div>
            {rows.map((r, i) => (
              <div key={`${r.name}-${i}`} className={`lb-row${i < 3 ? ' lb-top' : ''}`}>
                <span className="lb-rank px">{i + 1}</span>
                <span className="lb-grove">{r.name}</span>
                <span className="lb-keeper px">{shortWallet(r.wallet)}</span>
                <span className="lb-num lb-coins">{fmtCoins(r.coins)}</span>
                <span className="lb-num lb-earned px">
                  {sol(r.earnedLamports)}
                  {r.pendingLamports > 0 && <span className="lb-pending"> +{sol(r.pendingLamports)} pending</span>}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="dash-footer">
          <Link href="/" className="dash-back px">← Back to the groves</Link>
        </div>
      </main>
    </div>
  );
}
