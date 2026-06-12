'use client';

import React, { useEffect, useRef } from 'react';

export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let a = 1234567;
      const rng = () => {
        a = (a * 16807) % 2147483647;
        return a / 2147483647;
      };
      for (let i = 0; i < 300; i++) {
        const x = rng() * canvas.width;
        const y = rng() * canvas.height;
        const r = rng();
        if (r > 0.97) {
          ctx.fillStyle = ['#73eff7', '#c7a6ff', '#19c37d'][i % 3];
          ctx.fillRect(x, y, 2, 2);
        } else {
          ctx.fillStyle = `rgba(205, 214, 255, ${0.15 + r * 0.45})`;
          ctx.fillRect(x, y, r > 0.85 ? 2 : 1, r > 0.85 ? 2 : 1);
        }
      }
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, []);

  return <canvas ref={ref} className="starfield" />;
}
