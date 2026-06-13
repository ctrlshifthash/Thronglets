'use client';

import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { toSolanaWalletConnectors, useWallets } from '@privy-io/react-auth/solana';
import React, { useEffect, useState } from 'react';

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

interface Holding {
  balance: number;
  pct: number;
  tier: { name: string; multiplier: number; eligible: boolean };
}

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toString();

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="dash-stat">
      <div className="dash-stat-label px">{label}</div>
      <div className="dash-stat-value px">{value}</div>
      {hint && <div className="dash-stat-hint">{hint}</div>}
    </div>
  );
}

function Inner() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const address = wallets[0]?.address ?? null;
  const [h, setH] = useState<Holding | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setH(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/rewards?address=${address}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && !d.error) setH(d as Holding);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!ready) return <div className="dash-note">Loading wallet…</div>;

  if (!authenticated || !address) {
    return (
      <div className="dash-connect">
        <button className="dash-connect-btn px" onClick={login}>Connect Wallet</button>
        <span className="dash-connect-sub">Solana · Privy</span>
      </div>
    );
  }

  const mult = h?.tier.multiplier;
  const multText = mult === undefined ? (loading ? '…' : '—') : mult === 0 ? 'coins only' : `${mult}×`;

  return (
    <>
      <div className="dash-wallet">
        <span className="dash-wallet-addr px">{address.slice(0, 4)}…{address.slice(-4)}</span>
        <button className="dash-disconnect px" onClick={logout}>Disconnect</button>
      </div>

      <div className="dash-grid">
        <Stat label="HOLDING" value={h ? `${fmt(h.balance)}` : loading ? '…' : '—'} hint={h ? `${h.pct.toFixed(3)}% of supply` : '$THRONG'} />
        <Stat label="TIER" value={h?.tier.name ?? (loading ? '…' : '—')} hint="by how much you hold" />
        <Stat label="MULTIPLIER" value={multText} hint="scales your share" />
        <Stat label="COINS EARNED" value="—" hint="link your grove (soon)" />
        <Stat label="QUESTS DONE" value="—" hint="soon" />
        <Stat label="PENDING REWARD" value="—" hint="daily pool — Stage 2" />
      </div>

      <div className="dash-claim">
        <div className="dash-claim-info">
          <div className="dash-claim-title px">CLAIM REWARDS</div>
          <div className="dash-claim-sub">Daily payouts go live next — connect now to lock in your tier.</div>
        </div>
        <button className="dash-claim-btn px" disabled title="Payouts coming soon">CLAIM</button>
      </div>
    </>
  );
}

export function WalletSection() {
  if (!APP_ID) {
    return <div className="dash-note">Wallet connect isn’t configured yet.</div>;
  }
  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        appearance: { walletChainType: 'solana-only' },
        externalWallets: { solana: { connectors: toSolanaWalletConnectors() } },
      }}
    >
      <Inner />
    </PrivyProvider>
  );
}
