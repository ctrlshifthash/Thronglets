import type { Metadata } from 'next';
import { DashboardClient } from './dashboard-client';

export const metadata: Metadata = {
  title: 'Thronglets — Keeper Dashboard',
  description: 'Your holdings, tier, coins and rewards. Hold $THRONG to earn real rewards from raising your grove.',
};

export default function DashboardPage() {
  return <DashboardClient />;
}
