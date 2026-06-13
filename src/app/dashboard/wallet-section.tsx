'use client';

import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { toSolanaWalletConnectors, useWallets } from '@privy-io/react-auth/solana';
import React, { useCallback, useEffect, useState } from 'react';

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

interface Holding {
  balance: number;
  pct: number;
  tier: { name: string; multiplier: number; eligible: boolean };
}

interface MyGrove {
  slug: string;
  name: string;
  token: string | null;
}

interface GroveStatus {
  slug: string;
  name: string;
  coins: number;
  linkedWallet: string | null;
  pendingSol: number;
  nextClaimAt: number;
  claimable: boolean;
  enabled: boolean;
}

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toString();

const fmtSol = (n: number) => (n >= 1 ? n.toFixed(3) : n.toFixed(4));

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

function readMyGroves(): MyGrove[] {
  try {
    const list = JSON.parse(localStorage.getItem('my-groves') ?? '[]') as Array<{ slug: string; name: string }>;
    return list.slice(0, 12).map((g) => ({ ...g, token: localStorage.getItem(`grove-token-${g.slug}`) }));
  } catch {
    return [];
  }
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="dash-stat">
      <div className="dash-stat-label px">{label}</div>
      <div className="dash-stat-value px">{value}</div>
      {hint && <div className="dash-stat-hint">{hint}</div>}
    </div>
  );
}

/** Live H/M/S until `target`. */
function useCountdown(target: number): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const ms = Math.max(0, target - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function GroveRewardCard({ grove, wallet }: { grove: MyGrove; wallet: string }) {
  const [st, setSt] = useState<GroveStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!grove.token) return;
    try {
      const r = await fetch(`/api/rewards/grove?slug=${grove.slug}`, { headers: { 'x-owner-token': grove.token } });
      if (r.ok) setSt((await r.json()) as GroveStatus);
    } catch {
      /* transient */
    }
  }, [grove.slug, grove.token]);

  useEffect(() => {
    void load();
    const i = setInterval(() => void load(), 30_000); // keep pending fresh
    return () => clearInterval(i);
  }, [load]);

  // Re-renders every second, so the cooldown text ticks and the button
  // flips to Claim on its own when the 12h window elapses.
  const cd = useCountdown(st?.nextClaimAt ?? 0);

  const post = async (path: string) => {
    if (!grove.token) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-owner-token': grove.token },
        body: JSON.stringify({ slug: grove.slug, wallet }),
      });
      const d = (await r.json()) as { error?: string; amountSol?: number; signature?: string };
      if (!r.ok) setMsg(d.error ?? 'Something went wrong.');
      else if (d.signature) setMsg(`✓ Sent ${fmtSol(d.amountSol ?? 0)} SOL`);
      await load();
    } catch {
      setMsg('Network error — try again.');
    } finally {
      setBusy(false);
    }
  };

  const linkedHere = st?.linkedWallet === wallet;
  const linkedElsewhere = !!st?.linkedWallet && st.linkedWallet !== wallet;
  const now = Date.now();
  const onCooldown = !!st && linkedHere && !st.claimable && st.pendingSol > 0 && now < st.nextClaimAt;

  return (
    <div className="dash-grove">
      <div className="dash-grove-head">
        <span className="dash-grove-name px">{grove.name}</span>
        <span className="dash-grove-coins">{st ? `${fmt(st.coins)} coins` : '…'}</span>
      </div>

      {!grove.token ? (
        <div className="dash-grove-note">Owner key isn’t on this browser — open this grove on the device you made it.</div>
      ) : !st ? (
        <div className="dash-grove-note">Loading…</div>
      ) : !st.linkedWallet ? (
        <div className="dash-grove-body">
          <span className="dash-grove-pending">Link this grove to start earning.</span>
          <button className="dash-link-btn px" onClick={() => post('/api/rewards/link')} disabled={busy}>
            {busy ? '…' : 'LINK TO THIS WALLET'}
          </button>
        </div>
      ) : linkedElsewhere ? (
        <div className="dash-grove-body">
          <span className="dash-grove-pending">Paid to {short(st.linkedWallet!)} (a different wallet).</span>
          <button className="dash-link-btn px" onClick={() => post('/api/rewards/link')} disabled={busy}>
            {busy ? '…' : 'RE-LINK TO THIS WALLET'}
          </button>
        </div>
      ) : (
        <div className="dash-grove-body">
          <span className="dash-grove-pending">
            <b>{fmtSol(st.pendingSol)} SOL</b> pending
          </span>
          {!st.enabled ? (
            <span className="dash-badge">Payouts launch soon</span>
          ) : st.claimable ? (
            <button className="dash-claim-btn px" onClick={() => post('/api/rewards/claim')} disabled={busy}>
              {busy ? 'SENDING…' : `CLAIM ${fmtSol(st.pendingSol)} SOL`}
            </button>
          ) : onCooldown ? (
            <span className="dash-cooldown px">Next claim in {cd}</span>
          ) : (
            <span className="dash-badge">Earning — check back</span>
          )}
        </div>
      )}

      {msg && <div className="dash-grove-msg">{msg}</div>}
    </div>
  );
}

function GrovesPanel({ wallet }: { wallet: string }) {
  const [groves, setGroves] = useState<MyGrove[] | null>(null);
  useEffect(() => setGroves(readMyGroves()), []);

  if (!groves) return null;
  if (groves.length === 0) {
    return (
      <div className="dash-groves">
        <div className="dash-grove-note">
          You haven’t raised a grove yet. Start one from the groves page, complete quests to earn coins, then claim here.
        </div>
      </div>
    );
  }
  return (
    <div className="dash-groves">
      <div className="dash-groves-head px">YOUR GROVES</div>
      {groves.map((g) => (
        <GroveRewardCard key={g.slug} grove={g} wallet={wallet} />
      ))}
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
        <span className="dash-wallet-addr px">{short(address)}</span>
        <button className="dash-disconnect px" onClick={logout}>Disconnect</button>
      </div>

      <div className="dash-grid">
        <Stat label="HOLDING" value={h ? `${fmt(h.balance)}` : loading ? '…' : '—'} hint={h ? `${h.pct.toFixed(3)}% of supply` : '$THRONG'} />
        <Stat label="TIER" value={h?.tier.name ?? (loading ? '…' : '—')} hint="by how much you hold" />
        <Stat label="MULTIPLIER" value={multText} hint="scales your share" />
      </div>

      <GrovesPanel wallet={address} />
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
