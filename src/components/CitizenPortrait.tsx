'use client';

import React, { useEffect, useRef } from 'react';
import { CHAR_FRAMES, PALETTE, PLAYER_TINTS } from '@/lib/tiles';
import type { AgentRole } from '@/lib/types';

/** Same role→tunic mapping the scene uses. */
export const ROLE_TINT_INDEX: Record<AgentRole, number> = {
  farmer: 2,
  technician: 5,
  researcher: 6,
  keeper: 4,
  free: 3,
};

/** Tiny pixel portrait drawn straight from the sprite pattern. */
export function CitizenPortrait({ role, size = 28 }: { role: AgentRole; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 16, 16);
    const tint = PLAYER_TINTS[ROLE_TINT_INDEX[role] ?? 0];
    const rows = CHAR_FRAMES.down0;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const ch = rows[y][x];
        if (ch === '.') continue;
        const color = ch === 'T' ? tint : PALETTE[ch];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [role]);

  return <canvas ref={ref} style={{ width: size, height: size, imageRendering: 'pixelated' }} />;
}
