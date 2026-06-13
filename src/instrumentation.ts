// Next.js runs register() once when the server process starts. We use it to
// kick off the reward accrual loop, so holders earn passively on a schedule
// instead of only when someone opens the dashboard. Node runtime only.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startAccrualLoop } = await import('@/lib/rewardLedger');
  startAccrualLoop();
}
