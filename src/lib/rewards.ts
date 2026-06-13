// ─────────────────────────────────────────────────────────────────────
// Token-gated rewards. Real-money payouts are gated behind holding the
// $THRONG token: hold nothing and you only earn (non-cashable) in-game
// coins; hold the token and your coins translate into a share of the
// daily reward pool, scaled by a holding-tier multiplier.
//
// The multiplier scales a player's SHARE of a FIXED daily pool — it
// never grows the pool — so the system is always sustainable. The curve
// rewards a "sweet spot" then penalises over-holding, to keep any one
// wallet from accumulating a chart-nuking bag.
//
// NOTE: this module is pure config/logic. Nothing here moves funds. The
// payout signer reads its key from process.env at runtime — never here,
// never committed.
// ─────────────────────────────────────────────────────────────────────

/** $THRONG — the token holdings are measured against (Solana / pump.fun). */
export const TOKEN_MINT = 'B5PqW6EgYhgUdtjyfp8TzHGNKKaDUtjNCSWL7bPbpump';
export const TOKEN_SOLSCAN = `https://solscan.io/token/${TOKEN_MINT}`;
export const TOKEN_PUMP = `https://pump.fun/coin/${TOKEN_MINT}`;

/** Players may claim their accrued rewards at most this many times per day. */
export const CLAIMS_PER_DAY = 2;
export const CLAIM_INTERVAL_MS = (24 / CLAIMS_PER_DAY) * 60 * 60 * 1000; // 12h

export interface Tier {
  name: string;
  /** Inclusive lower bound, as a percent of total supply. */
  minPct: number;
  /** Exclusive upper bound. */
  maxPct: number;
  /** Reward-share multiplier. 0 = not eligible for real rewards (coins only). */
  multiplier: number;
  eligible: boolean;
  blurb: string;
}

/**
 * Holding tiers. The multiplier climbs to a peak at 3.5–3.8% of supply,
 * then drops BELOW base above 3.8% — over-holding in one wallet is
 * actively penalised so no whale is incentivised to nuke the chart.
 */
export const TIERS: Tier[] = [
  { name: 'Visitor', minPct: 0, maxPct: 0.05, multiplier: 0, eligible: false, blurb: 'Earn coins only — not cashable. Hold the token to unlock real rewards.' },
  { name: 'Keeper', minPct: 0.05, maxPct: 0.5, multiplier: 1.0, eligible: true, blurb: 'Eligible for the daily pool at base rate.' },
  { name: 'Warden', minPct: 0.5, maxPct: 1, multiplier: 1.25, eligible: true, blurb: '+25% share for holding more.' },
  { name: 'Steward', minPct: 1, maxPct: 2, multiplier: 1.5, eligible: true, blurb: '+50% share.' },
  { name: 'Elder', minPct: 2, maxPct: 3, multiplier: 2.0, eligible: true, blurb: 'Double share.' },
  { name: 'Patron', minPct: 3, maxPct: 3.5, multiplier: 2.5, eligible: true, blurb: '2.5× share.' },
  { name: 'Guardian', minPct: 3.5, maxPct: 3.8, multiplier: 3.0, eligible: true, blurb: 'The sweet spot — peak 3× share.' },
  { name: 'Overgrown', minPct: 3.8, maxPct: Infinity, multiplier: 0.5, eligible: true, blurb: 'Too much in one wallet — earnings are halved. Trim back to Guardian.' },
];

/** The tier for a given holding (percent of total supply). */
export function tierFor(pct: number): Tier {
  return TIERS.find((t) => pct >= t.minPct && pct < t.maxPct) ?? TIERS[0];
}

// ─────────────────────────────────────────────────────────────────────
// Payout config (Stage 2). Everything that decides how much real money
// can move is read from env at runtime, so the safe defaults below ship
// in code and the live numbers live only on the server:
//
//   REWARDS_ENABLED   "true" to arm payouts        (default: OFF)
//   SOLANA_CLUSTER    "mainnet-beta" | "devnet"    (default: mainnet-beta)
//   DAILY_POOL_SOL    the whole daily budget       (default: 0.02)
//   MIN_CLAIM_SOL     dust floor per claim          (default: 0.002)
//   PER_CLAIM_CAP_SOL ceiling on a single claim     (default: = daily pool)
//
// The hard ceiling on total spend is min(daily pool emitted, treasury
// balance) — you can never lose more than what you fund the wallet with.
// ─────────────────────────────────────────────────────────────────────

export const LAMPORTS_PER_SOL = 1_000_000_000;

export interface PayoutConfig {
  enabled: boolean;
  cluster: 'mainnet-beta' | 'devnet';
  dailyPoolLamports: number;
  /** Pool emitted per 12h window = daily pool ÷ claims-per-day. */
  windowLamports: number;
  minClaimLamports: number;
  perClaimCapLamports: number;
  /** Headroom kept in the treasury for the tx fee, never sent out. */
  feeBufferLamports: number;
}

const toLamports = (v: string | undefined, fallbackSol: number): number =>
  Math.max(0, Math.round((Number(v) > 0 ? Number(v) : fallbackSol) * LAMPORTS_PER_SOL));

export function payoutConfig(): PayoutConfig {
  const dailyPoolLamports = toLamports(process.env.DAILY_POOL_SOL, 0.02);
  return {
    enabled: process.env.REWARDS_ENABLED === 'true',
    cluster: process.env.SOLANA_CLUSTER === 'devnet' ? 'devnet' : 'mainnet-beta',
    dailyPoolLamports,
    windowLamports: Math.floor(dailyPoolLamports / CLAIMS_PER_DAY),
    minClaimLamports: toLamports(process.env.MIN_CLAIM_SOL, 0.002),
    perClaimCapLamports: toLamports(process.env.PER_CLAIM_CAP_SOL, dailyPoolLamports / LAMPORTS_PER_SOL),
    feeBufferLamports: 5000,
  };
}

// ── World-creation limit (anti-farm) ───────────────────────────────────
// Each wallet gets a couple of free groves; beyond that, creating one costs
// a flat SOL fee (paid on-chain to the treasury, verified server-side). The
// fee makes mass grove-farming uneconomical and helps fund the reward pool.

/** Free groves a single wallet may create before the fee applies. */
export const WORLD_FREE_LIMIT = Number(process.env.WORLD_FREE_LIMIT) > 0 ? Number(process.env.WORLD_FREE_LIMIT) : 2;

/** Fee in lamports to create a grove beyond the free allowance. Default 0.3 SOL. */
export function worldFeeLamports(): number {
  return toLamports(process.env.WORLD_FEE_SOL, 0.3);
}

export function worldFeeSol(): number {
  return worldFeeLamports() / LAMPORTS_PER_SOL;
}
