'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import React, { useState } from 'react';
import { CLAIMS_PER_DAY, TIERS, TOKEN_MINT, TOKEN_PUMP, TOKEN_SOLSCAN } from '@/lib/rewards';

// Privy + wallet code is browser-only — load it client-side to avoid SSR issues.
const WalletSection = dynamic(() => import('./wallet-section').then((m) => m.WalletSection), {
  ssr: false,
  loading: () => <div className="dash-note">Loading wallet…</div>,
});

export function DashboardClient() {
  const [copied, setCopied] = useState(false);

  const copyCa = () => {
    void navigator.clipboard?.writeText(TOKEN_MINT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="dash-root">
      <header className="dash-topbar">
        <Link href="/" className="dash-brand px">THRONGLETS</Link>
        <nav className="dash-nav">
          <Link href="/" className="dash-link px">HOME</Link>
          <Link href="/docs" className="dash-link px">DOCS</Link>
        </nav>
      </header>

      <main className="dash-main">
        <p className="dash-eyebrow px">KEEPER DASHBOARD</p>
        <h1 className="dash-h1 px">Your Grove, Your Rewards</h1>
        <p className="dash-lede">
          Raise a thriving grove to earn coins. Hold <b>$THRONG</b> and those coins become a share of the daily
          reward pool — paid out in real funds, claimable twice a day. Connect your Solana wallet to see your
          tier.
        </p>

        <WalletSection />

        {/* Tiers */}
        <section className="dash-section">
          <h2 className="dash-h2 px">Holding Tiers</h2>
          <p className="dash-p">
            The more $THRONG you hold the bigger your share of the daily pool — up to the <b>Guardian</b> sweet
            spot. Hold too much in one wallet and your rewards are halved, so no single wallet is rewarded for
            hoarding a chart-nuking bag.
          </p>
          <div className="dash-tiers">
            <div className="dash-tier-head">
              <span>Tier</span>
              <span>Holding</span>
              <span>Reward</span>
            </div>
            {TIERS.map((t) => (
              <div key={t.name} className={`dash-tier${t.name === 'Guardian' ? ' peak' : t.name === 'Overgrown' ? ' penalty' : ''}`}>
                <span className="dash-tier-name px">{t.name}</span>
                <span className="dash-tier-hold">
                  {t.maxPct === Infinity ? `${t.minPct}%+` : `${t.minPct}–${t.maxPct}%`}
                </span>
                <span className="dash-tier-mult px">{t.multiplier === 0 ? 'coins only' : `${t.multiplier}×`}</span>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="dash-section">
          <h2 className="dash-h2 px">How Rewards Work</h2>
          <ul className="dash-list">
            <li><b>Earn by playing.</b> Completing quests and keeping your grove thriving earns coins — your score for the day.</li>
            <li><b>Hold to cash out.</b> Hold $THRONG and your coins convert into a share of a fixed daily pool. Hold nothing and coins stay in-game only.</li>
            <li><b>Fixed pool, fair split.</b> Each day's pool is a set amount. Your payout is your share of it — more players means smaller slices, never a bigger bill, so it stays sustainable.</li>
            <li><b>Claim twice a day.</b> Your pending rewards build up; claim them up to {CLAIMS_PER_DAY} times daily to your wallet.</li>
          </ul>
        </section>

        {/* Token */}
        <div className="dash-ca">
          <span className="dash-ca-label px">$THRONG</span>
          <code className="dash-ca-addr">{TOKEN_MINT}</code>
          <button className="dash-ca-copy px" onClick={copyCa}>{copied ? 'COPIED' : 'COPY'}</button>
          <a className="dash-ca-link" href={TOKEN_SOLSCAN} target="_blank" rel="noreferrer">Solscan</a>
          <a className="dash-ca-link" href={TOKEN_PUMP} target="_blank" rel="noreferrer">pump.fun</a>
        </div>

        <div className="dash-footer">
          <Link href="/" className="dash-back px">← Back to the groves</Link>
        </div>
      </main>
    </div>
  );
}
