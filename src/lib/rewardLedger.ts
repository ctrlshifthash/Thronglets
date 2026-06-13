// ─────────────────────────────────────────────────────────────────────
// The reward ledger. Server-authoritative accrual + claiming.
//
// Accrual: once per 12h window, a single window's share of the daily pool
// (pool ÷ 2) is split across eligible groves by weight = coins × holding
// multiplier, and added to each grove's pending balance. Emission is
// strictly bounded — at most one window's pool per crossing — so total
// liability can never exceed the daily pool, no matter the player count.
//
// Claiming: owner-gated, 12h cooldown, re-checks holding eligibility, and
// never sends more than the treasury can cover. Funds debit ONLY after a
// confirmed transfer, and a per-slug lock prevents double-spend.
// ─────────────────────────────────────────────────────────────────────

import { db } from './db';
import { parseQuestState } from './quests';
import { CLAIM_INTERVAL_MS, LAMPORTS_PER_SOL, payoutConfig, tierFor } from './rewards';
import { sendSol, treasuryLamports } from './payout';
import { readHolding } from './solana';

const HOLDING_TTL_MS = 10 * 60 * 1000;
const windowOf = (ts: number): number => Math.floor(ts / CLAIM_INTERVAL_MS);

// ── Holding cache (avoids hammering the RPC during settlement) ─────────

export interface CachedHolding {
  pct: number;
  multiplier: number;
  updated_at: number;
}

export function getCachedHolding(wallet: string): CachedHolding | null {
  return (
    (db()
      .prepare('SELECT pct, multiplier, updated_at FROM holding_cache WHERE wallet = ?')
      .get(wallet) as CachedHolding | undefined) ?? null
  );
}

function upsertHolding(wallet: string, pct: number, multiplier: number): void {
  db()
    .prepare(
      `INSERT INTO holding_cache (wallet, pct, multiplier, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(wallet) DO UPDATE SET pct = excluded.pct, multiplier = excluded.multiplier, updated_at = excluded.updated_at`
    )
    .run(wallet, pct, multiplier, Date.now());
}

/** Read a wallet's holding fresh from chain and cache it. Falls back to cache on RPC error. */
export async function refreshHolding(wallet: string): Promise<CachedHolding> {
  try {
    const h = await readHolding(wallet);
    const multiplier = tierFor(h.pct).multiplier;
    upsertHolding(wallet, h.pct, multiplier);
    return { pct: h.pct, multiplier, updated_at: Date.now() };
  } catch {
    return getCachedHolding(wallet) ?? { pct: 0, multiplier: 0, updated_at: 0 };
  }
}

// ── Pure distribution (unit-tested) ────────────────────────────────────

/** Split `poolLamports` across groves proportional to weight. Sum ≤ pool. */
export function distribute(
  poolLamports: number,
  groves: Array<{ slug: string; weight: number }>
): Map<string, number> {
  const out = new Map<string, number>();
  const total = groves.reduce((s, g) => s + Math.max(0, g.weight), 0);
  if (total <= 0 || poolLamports <= 0) return out;
  for (const g of groves) {
    if (g.weight > 0) out.set(g.slug, Math.floor((poolLamports * g.weight) / total));
  }
  return out;
}

// ── Settlement ─────────────────────────────────────────────────────────

/**
 * Accrue one window's pool to eligible groves, if a new 12h window has
 * begun since the last settlement. Idempotent within a window; emits at
 * most one window's pool per call (conservative after downtime). No-op
 * when rewards are disabled.
 */
export function settle(now = Date.now()): void {
  const cfg = payoutConfig();
  if (!cfg.enabled) return;

  const state = db().prepare('SELECT last_window FROM reward_state WHERE id = 1').get() as
    | { last_window: number }
    | undefined;
  const cur = windowOf(now);
  if (state === undefined) {
    db().prepare('INSERT OR IGNORE INTO reward_state (id, last_window) VALUES (1, ?)').run(cur);
    return; // establish a baseline; never emit on the very first settle
  }
  if (cur <= state.last_window) return; // same window — nothing new to emit

  const rows = db()
    .prepare("SELECT slug, quests, payout_wallet FROM towns WHERE is_player = 1 AND payout_wallet <> ''")
    .all() as Array<{ slug: string; quests: string; payout_wallet: string }>;

  const groves: Array<{ slug: string; weight: number }> = [];
  for (const r of rows) {
    const coins = parseQuestState(r.quests).coins;
    if (coins <= 0) continue;
    const mult = getCachedHolding(r.payout_wallet)?.multiplier ?? 0;
    if (mult <= 0) continue; // not currently eligible (holds nothing / penalised to 0)
    groves.push({ slug: r.slug, weight: coins * mult });
  }

  const shares = distribute(cfg.windowLamports, groves);
  const upd = db().prepare('UPDATE towns SET pending_lamports = pending_lamports + ? WHERE slug = ?');
  for (const [slug, amt] of shares) if (amt > 0) upd.run(amt, slug);
  db().prepare('UPDATE reward_state SET last_window = ? WHERE id = 1').run(cur);
}

// ── Read a grove's reward state for the dashboard ──────────────────────

export interface GroveReward {
  linkedWallet: string | null;
  pendingLamports: number;
  pendingSol: number;
  nextClaimAt: number;
  claimable: boolean;
  enabled: boolean;
}

export function groveReward(slug: string, now = Date.now()): GroveReward {
  const cfg = payoutConfig();
  const row = db()
    .prepare('SELECT payout_wallet, pending_lamports, last_claim_at FROM towns WHERE slug = ?')
    .get(slug) as { payout_wallet: string; pending_lamports: number; last_claim_at: number } | undefined;
  const pending = row?.pending_lamports ?? 0;
  const nextClaimAt = (row?.last_claim_at ?? 0) + CLAIM_INTERVAL_MS;
  return {
    linkedWallet: row?.payout_wallet || null,
    pendingLamports: pending,
    pendingSol: pending / LAMPORTS_PER_SOL,
    nextClaimAt,
    claimable: cfg.enabled && pending >= cfg.minClaimLamports && now >= nextClaimAt,
    enabled: cfg.enabled,
  };
}

/** Point a grove's payouts at a wallet. Settles first so prior accrual is unaffected. */
export async function linkWallet(slug: string, wallet: string): Promise<void> {
  settle();
  await refreshHolding(wallet); // cache the multiplier so this grove can start earning
  db().prepare('UPDATE towns SET payout_wallet = ? WHERE slug = ?').run(wallet, slug);
}

// ── Claim ──────────────────────────────────────────────────────────────

export interface ClaimResult {
  ok: boolean;
  error?: string;
  signature?: string;
  amountSol?: number;
  pendingSol?: number;
  nextClaimAt?: number;
}

const inFlight = new Set<string>(); // per-slug lock: no concurrent claims

export async function claimReward(slug: string, wallet: string, now = Date.now()): Promise<ClaimResult> {
  const cfg = payoutConfig();
  if (!cfg.enabled) return { ok: false, error: 'Rewards are not live yet.' };
  if (inFlight.has(slug)) return { ok: false, error: 'A claim is already in progress.' };
  inFlight.add(slug);
  try {
    settle(now);

    const row = db()
      .prepare('SELECT payout_wallet, pending_lamports, last_claim_at FROM towns WHERE slug = ?')
      .get(slug) as { payout_wallet: string; pending_lamports: number; last_claim_at: number } | undefined;
    if (!row) return { ok: false, error: 'No such grove.' };
    if (!row.payout_wallet) return { ok: false, error: 'Link a wallet first.' };
    if (row.payout_wallet !== wallet) return { ok: false, error: 'This grove pays a different wallet.' };

    const nextClaimAt = row.last_claim_at + CLAIM_INTERVAL_MS;
    if (now < nextClaimAt) return { ok: false, error: 'Too soon — wait for the cooldown.', nextClaimAt };

    if (row.pending_lamports < cfg.minClaimLamports) return { ok: false, error: 'Nothing to claim yet.' };
    const amount = Math.min(row.pending_lamports, cfg.perClaimCapLamports);

    // Re-verify the wallet still holds enough $THRONG to be eligible.
    const h = await refreshHolding(wallet);
    if (h.multiplier <= 0) return { ok: false, error: 'Wallet no longer holds enough $THRONG to claim.' };

    // Never send more than the treasury can cover (keep the fee buffer).
    const treasury = await treasuryLamports();
    if (treasury < amount + cfg.feeBufferLamports) {
      return { ok: false, error: 'Reward treasury is refilling — try again shortly.' };
    }

    // Move funds. Only on a confirmed transfer do we debit + start the cooldown.
    let signature: string;
    try {
      signature = await sendSol(wallet, amount);
    } catch (e) {
      console.error('[rewardLedger] payout send failed', e);
      return { ok: false, error: 'Payout failed to send — no funds moved.' };
    }

    db()
      .prepare(
        'UPDATE towns SET pending_lamports = pending_lamports - ?, last_claim_at = ?, lifetime_paid_lamports = lifetime_paid_lamports + ? WHERE slug = ?'
      )
      .run(amount, now, amount, slug);

    return {
      ok: true,
      signature,
      amountSol: amount / LAMPORTS_PER_SOL,
      pendingSol: Math.max(0, row.pending_lamports - amount) / LAMPORTS_PER_SOL,
      nextClaimAt: now + CLAIM_INTERVAL_MS,
    };
  } finally {
    inFlight.delete(slug);
  }
}

// ── Background accrual loop ─────────────────────────────────────────────
// Without this, accrual only ran when a keeper happened to open their
// dashboard — so in practice holders never accrued. This refreshes every
// linked wallet's $THRONG holding from chain and settles on a schedule, so
// eligible holders earn passively whether or not they ever visit the site.

/** One pass: refresh stale holdings for all linked wallets, then settle. */
export async function accrualTick(): Promise<void> {
  const cfg = payoutConfig();
  if (!cfg.enabled) return;

  const wallets = db()
    .prepare("SELECT DISTINCT payout_wallet FROM towns WHERE is_player = 1 AND payout_wallet <> ''")
    .all() as Array<{ payout_wallet: string }>;

  const nowMs = Date.now();
  for (const { payout_wallet } of wallets) {
    const cached = getCachedHolding(payout_wallet);
    if (!cached || nowMs - cached.updated_at > HOLDING_TTL_MS) {
      await refreshHolding(payout_wallet); // sequential — gentle on the RPC
    }
  }

  settle(Date.now());
}

const ACCRUAL_TICK_MS = 5 * 60 * 1000; // every 5 min; settlement still emits per 12h window
let loopStarted = false;

/** Start the accrual loop once per server process (idempotent). */
export function startAccrualLoop(): void {
  if (loopStarted) return;
  loopStarted = true;
  const cfg = payoutConfig();
  console.log(
    `[rewards] accrual loop started (enabled=${cfg.enabled}, cluster=${cfg.cluster}, pool=${cfg.dailyPoolLamports / LAMPORTS_PER_SOL} SOL/day)`
  );
  const run = () => void accrualTick().catch((e) => console.error('[accrualTick]', e));
  run(); // kick once on boot
  const timer = setInterval(run, ACCRUAL_TICK_MS);
  if (typeof timer.unref === 'function') timer.unref(); // don't keep the process alive alone
}

// Keep the TTL referenced (used by callers deciding whether to refresh).
export { HOLDING_TTL_MS };
