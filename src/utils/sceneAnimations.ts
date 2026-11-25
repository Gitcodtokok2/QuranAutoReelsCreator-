import { SceneAnimationLayer } from '../types/studio';

interface MotionSeed {
  x: number;
  y: number;
  speed: number;
  size: number;
  phase: number;
  alpha: number;
  drift: number;
}

const MOTION_SEEDS: MotionSeed[] = Array.from({ length: 90 }, (_, i) => {
  const h = (n: number) => {
    const v = Math.sin(n) * 43758.5453123;
    return v - Math.floor(v);
  };
  return {
    x: h(i * 12.9898 + 1.1),
    y: h(i * 78.233 + 2.7),
    speed: 0.4 + h(i * 39.425 + 4.3) * 1.1,
    size: 0.5 + h(i * 93.112 + 7.9) * 1.5,
    phase: h(i * 51.77 + 3.2) * Math.PI * 2,
    alpha: 0.25 + h(i * 64.19 + 9.4) * 0.65,
    drift: (h(i * 23.45 + 6.1) - 0.5) * 2,
  };
});

/**
 * Pure 4K-crisp procedural Astral Sacred Geometry animated backdrop
 * (slow-rotating delicate golden Islamic 8-fold star filigree + cosmic depth breathing with voice).
 */
export function drawSacredNebulaBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  audioLevel: number,
  accentColor: string
) {
  const scale = width / 1080;
  ctx.save();

  // Deep obsidian-to-indigo celestial canvas
  const bgGrad = ctx.createLinearGradient(0, 0, width * 0.25, height);
  bgGrad.addColorStop(0, '#060814');
  bgGrad.addColorStop(0.45, '#0B1226');
  bgGrad.addColorStop(0.78, '#110E1B');
  bgGrad.addColorStop(1, '#06060A');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Flowing multi-layered cosmic nebula clouds
  const breath = 1 + audioLevel * 0.22;
  const clouds = [
    {
      cx: width * (0.35 + Math.sin(time * 0.18) * 0.14),
      cy: height * (0.32 + Math.cos(time * 0.15) * 0.08),
      r: width * 0.78 * breath,
      c0: 'rgba(212, 168, 83, 0.15)',
      c1: 'rgba(99, 102, 241, 0.05)',
    },
    {
      cx: width * (0.68 + Math.cos(time * 0.21) * 0.12),
      cy: height * (0.64 + Math.sin(time * 0.14) * 0.09),
      r: width * 0.85 * breath,
      c0: 'rgba(37, 99, 235, 0.16)',
      c1: 'rgba(15, 23, 42, 0.04)',
    },
    {
      cx: width * 0.5,
      cy: height * 0.48,
      r: width * 0.52 * (1 + audioLevel * 0.35),
      c0: 'rgba(245, 214, 142, 0.12)',
      c1: 'rgba(212, 168, 83, 0)',
    },
  ];

  for (const c of clouds) {
    const g = ctx.createRadialGradient(c.cx, c.cy, 0, c.cx, c.cy, c.r);
    g.addColorStop(0, c.c0);
    g.addColorStop(0.55, c.c1);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  // Slow-rotating sacred 8-point & 12-point golden filigree mandala behind text
  ctx.save();
  ctx.translate(width / 2, height * 0.48);

  const outerRadius = width * 0.44 * (1 + Math.sin(time * 0.4) * 0.02 + audioLevel * 0.04);
  const innerRadius = outerRadius * 0.62;

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.4 * scale;

  // Outer rotating 12-pointed star lattice
  ctx.save();
  ctx.rotate(time * 0.055);
  ctx.globalAlpha = 0.14 + audioLevel * 0.1;
  for (let k = 0; k < 3; k++) {
    ctx.rotate(Math.PI / 6);
    ctx.strokeRect(-outerRadius * 0.65, -outerRadius * 0.65, outerRadius * 1.3, outerRadius * 1.3);
  }
  ctx.beginPath();
  ctx.arc(0, 0, outerRadius * 0.92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Counter-rotating inner 8-point Rub el Hizb star
  ctx.save();
  ctx.rotate(-time * 0.085);
  ctx.globalAlpha = 0.2 + audioLevel * 0.12;
  for (let k = 0; k < 2; k++) {
    ctx.rotate(Math.PI / 4);
    ctx.strokeRect(-innerRadius * 0.68, -innerRadius * 0.68, innerRadius * 1.36, innerRadius * 1.36);
  }
  ctx.beginPath();
  ctx.arc(0, 0, innerRadius * 0.96, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.restore();

  // Twinkling cosmic starlight field
  for (let i = 0; i < 60; i++) {
    const p = MOTION_SEEDS[i];
    const px = ((p.x + time * 0.004 * p.speed) % 1) * width;
    const py = p.y * height;
    const twinkle = Math.pow(0.5 + 0.5 * Math.sin(time * (1.1 + p.speed) + p.phase), 2);
    const r = (1.1 + p.size * 1.3) * scale;
    ctx.fillStyle = `rgba(255, 248, 230, ${p.alpha * twinkle * 0.75})`;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Renders rich, signature 60fps animated visual motion layers unique to each scene world.
 * Gives every scene unmistakable living 4K video motion that hooks TikTok viewers immediately.
 */
export function drawSceneAnimationLayer(
  ctx: CanvasRenderingContext2D,
  layer: SceneAnimationLayer,
  width: number,
  height: number,
  time: number,
  audioLevel: number,
  alpha: number
) {
  if (alpha <= 0.01) return;
  const scale = width / 1080;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  if (layer === 'rain-glass') {
    // 1. Soft atmospheric bokeh halos pulsing gently in depth
    for (let i = 0; i < 10; i++) {
      const p = MOTION_SEEDS[i];
      const bx = (p.x + Math.sin(time * 0.25 + p.phase) * 0.03) * width;
      const by = (0.15 + p.y * 0.7) * height;
      const br = (36 + p.size * 44) * scale * (1 + audioLevel * 0.14);
      const bAlpha = (0.045 + 0.035 * Math.sin(time * 0.9 + p.phase)) * alpha;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, `rgba(245, 210, 140, ${bAlpha * 1.6})`);
      g.addColorStop(0.6, `rgba(186, 212, 245, ${bAlpha * 0.6})`);
      g.addColorStop(1, 'rgba(186, 212, 245, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Glistening raindrops sliding down glass with delicate wet trails & refraction dots
    ctx.lineCap = 'round';
    for (let i = 0; i < 28; i++) {
      const p = MOTION_SEEDS[i + 15];
      const progress = (p.y + time * (0.075 + p.speed * 0.09)) % 1.18 - 0.09;
      const wobble = Math.sin(progress * 18 + p.phase) * 3.5 * scale;
      const px = p.x * width + wobble;
      const py = progress * height;
      const dropR = (2.4 + p.size * 2.6) * scale;
      const trailLen = (48 + p.size * 72) * scale;

      // Wet glass trail behind drop
      const trailGrad = ctx.createLinearGradient(px, py - trailLen, px, py);
      trailGrad.addColorStop(0, 'rgba(215, 232, 250, 0)');
      trailGrad.addColorStop(1, `rgba(225, 238, 255, ${0.22 * p.alpha})`);
      ctx.strokeStyle = trailGrad;
      ctx.lineWidth = dropR * 0.72;
      ctx.beginPath();
      ctx.moveTo(px - wobble * 0.4, py - trailLen);
      ctx.lineTo(px, py);
      ctx.stroke();

      // Refracted water bead
      ctx.fillStyle = `rgba(235, 244, 255, ${0.42 * p.alpha})`;
      ctx.beginPath();
      ctx.ellipse(px, py, dropR * 0.85, dropR * 1.25, 0, 0, Math.PI * 2);
      ctx.fill();

      // Crisp specular pinpoint highlight
      ctx.fillStyle = `rgba(255, 255, 255, ${0.75 * p.alpha})`;
      ctx.beginPath();
      ctx.arc(px - dropR * 0.25, py - dropR * 0.3, dropR * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Diagonal cinematic mist-rain streaks in far depth
    for (let i = 0; i < 45; i++) {
      const p = MOTION_SEEDS[i + 40];
      const y = (p.y + time * 0.65 * p.speed) % 1.15 - 0.08;
      const x = (p.x - time * 0.07 * p.speed + 10) % 1.1 - 0.05;
      const px = x * width;
      const py = y * height;
      const len = (24 + p.size * 26) * scale;
      ctx.strokeStyle = `rgba(210, 228, 248, ${0.18 * p.alpha})`;
      ctx.lineWidth = 1.2 * scale;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - len * 0.12, py + len);
      ctx.stroke();
    }
  } else if (layer === 'celestial-dunes') {
    // 1. Slow-drifting glowing constellations & horizon aurora breath
    const horizonGlow = ctx.createRadialGradient(
      width * 0.5,
      height * 0.56,
      0,
      width * 0.5,
      height * 0.56,
      width * 0.72
    );
    const glowStrength = 0.13 + Math.sin(time * 0.6) * 0.03 + audioLevel * 0.08;
    horizonGlow.addColorStop(0, `rgba(245, 196, 110, ${glowStrength})`);
    horizonGlow.addColorStop(0.6, `rgba(194, 134, 62, ${glowStrength * 0.35})`);
    horizonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = horizonGlow;
    ctx.fillRect(0, height * 0.2, width, height * 0.65);

    // 2. Twinkling upper-sky stars
    for (let i = 0; i < 55; i++) {
      const p = MOTION_SEEDS[i];
      const px = ((p.x + time * 0.0025 * p.speed) % 1) * width;
      const py = p.y * height * 0.54;
      const twinkle = Math.pow(0.5 + 0.5 * Math.sin(time * (1.4 + p.speed) + p.phase), 2.4);
      const r = (1.1 + p.size * 1.4) * scale;
      ctx.fillStyle = `rgba(244, 248, 255, ${p.alpha * twinkle * 0.85})`;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Periodic luminous shooting stars streaking diagonally across the Milky Way
    for (let s = 0; s < 2; s++) {
      const cycleDur = s === 0 ? 5.2 : 7.4;
      const localT = (time + s * 2.9) % cycleDur;
      if (localT < 0.95) {
        const tNorm = localT / 0.95;
        const startX = width * (s === 0 ? 0.85 : 0.68);
        const startY = height * (s === 0 ? 0.09 : 0.17);
        const travelX = -width * 0.42;
        const travelY = height * 0.16;
        const headX = startX + travelX * tNorm;
        const headY = startY + travelY * tNorm;
        const tailFrac = Math.max(0, tNorm - 0.18);
        const tailX = startX + travelX * tailFrac;
        const tailY = startY + travelY * tailFrac;
        const env = Math.sin(tNorm * Math.PI);

        const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        grad.addColorStop(0.7, `rgba(220, 236, 255, ${0.45 * env})`);
        grad.addColorStop(1, `rgba(255, 250, 230, ${0.95 * env})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.4 * scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(headX, headY);
        ctx.stroke();
      }
    }
  } else if (layer === 'moonlit-ocean') {
    // 1. Dancing golden-silver light reflections shimmering across moving twilight ocean ripples
    const horizonY = height * 0.51;
    for (let i = 0; i < 42; i++) {
      const p = MOTION_SEEDS[i];
      const depth = p.y; // 0 = near horizon, 1 = foreground wave
      const y = horizonY + depth * depth * (height * 0.46);
      const shimmer = 0.5 + 0.5 * Math.sin(time * (2.2 + p.speed * 2.0) + p.phase);
      const spreadX = (0.14 + depth * 0.48) * width;
      const x = width * 0.55 + (p.x - 0.5) * spreadX + Math.sin(time * 1.1 + i) * 14 * scale;
      const rippleW = (24 + depth * 90) * scale * (0.7 + 0.4 * shimmer);
      const rippleH = (1.6 + depth * 3.4) * scale;

      ctx.fillStyle = `rgba(252, 224, 168, ${(0.08 + 0.24 * shimmer * (1 + audioLevel * 0.5)) * (1 - depth * 0.35)})`;
      ctx.beginPath();
      ctx.roundRect(x - rippleW / 2, y, rippleW, rippleH, rippleH);
      ctx.fill();
    }

    // 2. Slow-drifting silky sea fog band above horizon
    for (let i = 0; i < 4; i++) {
      const driftX = ((time * (26 + i * 10) * scale + i * width * 0.42) % (width * 1.8)) - width * 0.4;
      const y = horizonY + (i - 1) * 44 * scale;
      const rad = width * 0.52;
      const fog = ctx.createRadialGradient(driftX, y, 0, driftX, y, rad);
      fog.addColorStop(0, 'rgba(230, 236, 245, 0.095)');
      fog.addColorStop(1, 'rgba(230, 236, 245, 0)');
      ctx.fillStyle = fog;
      ctx.fillRect(0, horizonY - rad, width, rad * 2);
    }
  } else if (layer === 'forest-sunbeams') {
    // 1. Volumetric golden dawn god-rays swaying gently through the canopy
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const originX = width * 0.88;
    const originY = height * 0.24;

    for (let i = 0; i < 6; i++) {
      const baseAngle = 2.05 + i * 0.14 + Math.sin(time * 0.32 + i * 1.1) * 0.045;
      const spread = (0.045 + (i % 2) * 0.025);
      const rayLen = height * 1.05;
      const rayOpacity = (0.055 + 0.03 * Math.sin(time * 0.7 + i * 1.7) + audioLevel * 0.04);

      const x1 = originX + Math.cos(baseAngle - spread) * rayLen;
      const y1 = originY + Math.sin(baseAngle - spread) * rayLen;
      const x2 = originX + Math.cos(baseAngle + spread) * rayLen;
      const y2 = originY + Math.sin(baseAngle + spread) * rayLen;

      const grad = ctx.createLinearGradient(originX, originY, (x1 + x2) / 2, (y1 + y2) / 2);
      grad.addColorStop(0, `rgba(255, 224, 152, ${rayOpacity * 1.8})`);
      grad.addColorStop(0.55, `rgba(232, 184, 96, ${rayOpacity * 0.7})`);
      grad.addColorStop(1, 'rgba(232, 184, 96, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 2. Floating sunlit forest motes drifting in the warm beams
    for (let i = 0; i < 36; i++) {
      const p = MOTION_SEEDS[i];
      const y = ((p.y - time * 0.022 * p.speed) % 1 + 1) % 1;
      const x = p.x + Math.sin(time * 0.6 * p.speed + p.phase) * 0.035;
      const px = x * width;
      const py = y * height;
      const r = (2 + p.size * 2.5) * scale;
      const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 2.8);
      glow.addColorStop(0, `rgba(255, 236, 184, ${0.65 * p.alpha})`);
      glow.addColorStop(1, 'rgba(255, 212, 120, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, r * 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (layer === 'lantern-glow') {
    // 1. Living breathing candlelight halos synced gently to the reciter's voice
    const lanterns = [
      { x: 0.5, y: 0.49, r: 0.24 },
      { x: 0.18, y: 0.5, r: 0.16 },
      { x: 0.87, y: 0.48, r: 0.17 },
    ];
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < lanterns.length; i++) {
      const l = lanterns[i];
      const flicker =
        0.88 +
        0.12 * Math.sin(time * (3.1 + i * 0.9) + i * 2) +
        audioLevel * 0.28;
      const cx = width * l.x;
      const cy = height * l.y;
      const rad = width * l.r * flicker;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      grad.addColorStop(0, `rgba(255, 215, 130, ${0.24 * flicker})`);
      grad.addColorStop(0.5, `rgba(218, 152, 64, ${0.1 * flicker})`);
      grad.addColorStop(1, 'rgba(218, 152, 64, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Rising warm golden embers drifting upward in the courtyard twilight
    for (let i = 0; i < 30; i++) {
      const p = MOTION_SEEDS[i + 5];
      const y = ((p.y - time * 0.036 * p.speed) % 1 + 1) % 1;
      const x = p.x + Math.sin(time * 0.9 + p.phase) * 0.025;
      const px = x * width;
      const py = y * height;
      const r = (1.8 + p.size * 2.2) * scale;
      const twinkle = 0.5 + 0.5 * Math.sin(time * 2.5 + p.phase);
      const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 3);
      glow.addColorStop(0, `rgba(255, 226, 158, ${0.72 * p.alpha * twinkle})`);
      glow.addColorStop(1, 'rgba(212, 168, 83, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, r * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (layer === 'sacred-nebula') {
    // Extra floating golden light threads over the generative geometry
    for (let i = 0; i < 24; i++) {
      const p = MOTION_SEEDS[i + 20];
      const y = ((p.y - time * 0.025 * p.speed) % 1 + 1) % 1;
      const x = p.x + Math.cos(time * 0.5 + p.phase) * 0.04;
      const px = x * width;
      const py = y * height;
      const r = (2 + p.size * 2.2) * scale;
      const g = ctx.createRadialGradient(px, py, 0, px, py, r * 3.2);
      g.addColorStop(0, `rgba(248, 224, 166, ${0.62 * p.alpha})`);
      g.addColorStop(1, 'rgba(212, 168, 83, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r * 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
