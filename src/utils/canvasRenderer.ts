import {
  ArabicFontFamily,
  ParticleEffect,
  PlaybackFrameState,
  SceneAsset,
  StudioConfig,
} from '../types/studio';

function getArabicFontStack(font: ArabicFontFamily | undefined): string {
  switch (font) {
    case 'scheherazade':
      return '"Scheherazade New", "Amiri", Georgia, serif';
    case 'noto-naskh':
      return '"Noto Naskh Arabic", "Amiri", Georgia, serif';
    case 'lateef':
      return '"Lateef", "Amiri", Georgia, serif';
    case 'amiri':
    default:
      return '"Amiri", Georgia, serif';
  }
}
import { drawSacredNebulaBackdrop, drawSceneAnimationLayer } from './sceneAnimations';
import {
  computeTransitionTransforms,
  computeWordRevealCount,
  easeOutCubic,
  toArabicIndicNumerals,
} from './timeline';

export type LoadedMediaMap = Map<string, HTMLImageElement | HTMLVideoElement>;

interface ParticleSeed {
  x: number;
  y: number;
  speed: number;
  size: number;
  phase: number;
  opacity: number;
}

// Deterministic particle seeds so preview & export frames are identical and smooth
const PARTICLE_SEEDS: ParticleSeed[] = Array.from({ length: 70 }, (_, i) => {
  const s1 = Math.sin(i * 12.9898) * 43758.5453;
  const s2 = Math.sin(i * 78.233 + 1.7) * 24634.6345;
  const s3 = Math.sin(i * 39.425 + 4.1) * 19283.1234;
  const s4 = Math.sin(i * 93.112 + 8.3) * 51823.7712;
  const frac = (n: number) => n - Math.floor(n);
  return {
    x: frac(s1),
    y: frac(s2),
    speed: 0.35 + frac(s3) * 0.9,
    size: 0.5 + frac(s4) * 1.5,
    phase: frac(s1 + s2) * Math.PI * 2,
    opacity: 0.25 + frac(s3 + s4) * 0.65,
  };
});

/**
 * Determines whether the current composition is on a light paper/parchment surface
 * so ink shadows, scrims, and accents stay crisp and WCAG-compliant.
 */
function isLightComposition(config: StudioConfig, activeScene?: SceneAsset): boolean {
  if (config.layoutMode === 'light-editorial') return true;
  if (config.scrimOpacity < 0.22 && activeScene?.isLightSurface) return true;
  if (config.scrimOpacity < 0.22 && (config.arabicColor.startsWith('#1') || config.arabicColor.startsWith('#2'))) {
    return true;
  }
  return false;
}

/**
 * Draws an image or video covering the target canvas with smooth Ken Burns zoom & pan.
 */
function drawSceneCover(
  ctx: CanvasRenderingContext2D,
  media: HTMLImageElement | HTMLVideoElement | undefined,
  fallbackGradient: [string, string, string],
  width: number,
  height: number,
  time: number,
  sceneSeed: number,
  motionIntensity: number,
  alpha: number
) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  let mediaW = 0;
  let mediaH = 0;
  let ready = false;

  if (media instanceof HTMLImageElement) {
    ready = media.complete && media.naturalWidth > 0;
    mediaW = media.naturalWidth;
    mediaH = media.naturalHeight;
  } else if (media instanceof HTMLVideoElement) {
    ready = media.readyState >= 2 && media.videoWidth > 0;
    mediaW = media.videoWidth;
    mediaH = media.videoHeight;
  }

  if (ready && media && mediaW > 0 && mediaH > 0) {
    const dirX = sceneSeed % 2 === 0 ? 1 : -1;
    const dirY = sceneSeed % 3 === 0 ? -1 : 1;
    const cycle = (time * 0.08 + sceneSeed * 0.7) % 2;
    const smoothWave = Math.sin(cycle * Math.PI * 0.5);

    const zoom = 1.03 + motionIntensity * (0.04 + 0.06 * smoothWave);
    const maxPanX = width * 0.032 * motionIntensity;
    const maxPanY = height * 0.025 * motionIntensity;
    const panX = Math.sin(time * 0.22 + sceneSeed * 1.9) * maxPanX * dirX;
    const panY = Math.cos(time * 0.18 + sceneSeed * 1.3) * maxPanY * dirY;

    const scale = Math.max(width / mediaW, height / mediaH) * zoom;
    const drawW = mediaW * scale;
    const drawH = mediaH * scale;
    const dx = (width - drawW) / 2 + panX;
    const dy = (height - drawH) / 2 + panY;

    ctx.drawImage(media, dx, dy, drawW, drawH);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, fallbackGradient[0]);
    grad.addColorStop(0.55, fallbackGradient[1]);
    grad.addColorStop(1, fallbackGradient[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}

/**
 * Draws deterministic atmospheric particle effects over the scene.
 */
function drawParticles(
  ctx: CanvasRenderingContext2D,
  effect: ParticleEffect,
  width: number,
  height: number,
  time: number,
  accentColor: string
) {
  if (effect === 'none') return;
  const scale = width / 1080;

  ctx.save();

  if (effect === 'gold-dust') {
    for (let i = 0; i < 42; i++) {
      const p = PARTICLE_SEEDS[i];
      const y = (((p.y - time * 0.028 * p.speed) % 1) + 1) % 1;
      const x = p.x + Math.sin(time * 0.55 * p.speed + p.phase) * 0.03;
      const px = x * width;
      const py = y * height;
      const radius = (2.2 + p.size * 2.8) * scale;
      const twinkle = 0.45 + 0.55 * Math.sin(time * 1.6 + p.phase);
      const alpha = p.opacity * twinkle * 0.62;

      const glow = ctx.createRadialGradient(px, py, 0, px, py, radius * 2.6);
      glow.addColorStop(0, `rgba(245, 224, 168, ${alpha})`);
      glow.addColorStop(0.45, `rgba(212, 168, 83, ${alpha * 0.45})`);
      glow.addColorStop(1, 'rgba(212, 168, 83, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, radius * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (effect === 'gentle-rain') {
    ctx.lineCap = 'round';
    for (let i = 0; i < 65; i++) {
      const p = PARTICLE_SEEDS[i];
      const fallSpeed = 0.52 * p.speed;
      const y = ((p.y + time * fallSpeed) % 1.15) - 0.1;
      const x = ((p.x - time * 0.06 * p.speed + 10) % 1.1) - 0.05;
      const px = x * width;
      const py = y * height;
      const len = (26 + p.size * 24) * scale;

      ctx.strokeStyle = `rgba(218, 232, 248, ${p.opacity * 0.28})`;
      ctx.lineWidth = (1.1 + p.size * 0.45) * scale;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - len * 0.14, py + len);
      ctx.stroke();
    }
  } else if (effect === 'starlight') {
    for (let i = 0; i < 48; i++) {
      const p = PARTICLE_SEEDS[i];
      const px = p.x * width;
      const py = p.y * height * 0.65;
      const twinkle = Math.pow(0.5 + 0.5 * Math.sin(time * (1.2 + p.speed) + p.phase), 2);
      const alpha = p.opacity * twinkle * 0.85;
      const r = (1.3 + p.size * 1.4) * scale;

      ctx.fillStyle = `rgba(240, 246, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (effect === 'soft-mist') {
    for (let i = 0; i < 5; i++) {
      const driftX =
        ((time * (18 + i * 7) * scale + i * width * 0.35) % (width * 1.8)) - width * 0.4;
      const y = height * (0.62 + i * 0.085);
      const rad = width * (0.55 + i * 0.08);
      const grad = ctx.createRadialGradient(driftX, y, 0, driftX, y, rad);
      grad.addColorStop(0, 'rgba(226, 232, 240, 0.09)');
      grad.addColorStop(0.5, 'rgba(203, 213, 225, 0.04)');
      grad.addColorStop(1, 'rgba(203, 213, 225, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, height * 0.35, width, height * 0.65);
    }
  }

  void accentColor;
  ctx.restore();
}

/**
 * Draws layout-specific architectural/manuscript/minimal framing elements.
 */
function drawLayoutChrome(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: StudioConfig,
  lightSurface: boolean,
  scale: number,
  blockTopY: number,
  blockBottomY: number,
  opacity: number
) {
  ctx.save();

  if (config.layoutMode === 'mushaf-frame') {
    // Illuminated double manuscript border with delicate corner diamonds
    const padX = 56 * scale;
    const padTop = height * 0.095;
    const padBottom = height * 0.145;
    const frameW = width - padX * 2;
    const frameH = height - padTop - padBottom;

    // Soft parchment inner reading veil so text pops cleanly over ornate borders
    ctx.fillStyle = lightSurface
      ? 'rgba(250, 245, 234, 0.48)'
      : 'rgba(12, 10, 8, 0.36)';
    ctx.fillRect(padX + 12 * scale, padTop + 12 * scale, frameW - 24 * scale, frameH - 24 * scale);

    ctx.strokeStyle = config.accentColor;
    ctx.globalAlpha = lightSurface ? 0.68 : 0.52;
    ctx.lineWidth = 2.4 * scale;
    ctx.strokeRect(padX, padTop, frameW, frameH);

    ctx.globalAlpha = lightSurface ? 0.42 : 0.32;
    ctx.lineWidth = 1.2 * scale;
    ctx.strokeRect(
      padX + 12 * scale,
      padTop + 12 * scale,
      frameW - 24 * scale,
      frameH - 24 * scale
    );

    // Corner geometric accents
    const corners: [number, number][] = [
      [padX + 12 * scale, padTop + 12 * scale],
      [padX + frameW - 12 * scale, padTop + 12 * scale],
      [padX + 12 * scale, padTop + frameH - 12 * scale],
      [padX + frameW - 12 * scale, padTop + frameH - 12 * scale],
    ];
    ctx.fillStyle = config.accentColor;
    ctx.globalAlpha = lightSurface ? 0.78 : 0.65;
    const d = 6 * scale;
    for (const [cx, cy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - d);
      ctx.lineTo(cx + d, cy);
      ctx.lineTo(cx, cy + d);
      ctx.lineTo(cx - d, cy);
      ctx.closePath();
      ctx.fill();
    }
  } else if (config.layoutMode === 'minimal-obsidian') {
    // Ultra-refined architectural hairline frame with quiet corner ticks
    const m = 68 * scale;
    const tick = 34 * scale;
    ctx.strokeStyle = config.accentColor;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 1.6 * scale;

    ctx.beginPath();
    // Top-left
    ctx.moveTo(m, m + tick);
    ctx.lineTo(m, m);
    ctx.lineTo(m + tick, m);
    // Top-right
    ctx.moveTo(width - m - tick, m);
    ctx.lineTo(width - m, m);
    ctx.lineTo(width - m, m + tick);
    // Bottom-left (above TikTok caption bar)
    const bot = height * 0.84;
    ctx.moveTo(m, bot - tick);
    ctx.lineTo(m, bot);
    ctx.lineTo(m + tick, bot);
    // Bottom-right
    ctx.moveTo(width - m - tick, bot);
    ctx.lineTo(width - m, bot);
    ctx.lineTo(width - m, bot - tick);
    ctx.stroke();
  } else if (config.layoutMode === 'light-editorial') {
    // Subtle sunlit ivory editorial hairline rules framing the reading zone
    const padX = 88 * scale;
    ctx.strokeStyle = config.accentColor;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 1.4 * scale;
    ctx.beginPath();
    ctx.moveTo(padX, height * 0.195);
    ctx.lineTo(width - padX, height * 0.195);
    ctx.moveTo(padX, height * 0.745);
    ctx.lineTo(width - padX, height * 0.745);
    ctx.stroke();
  } else if (config.layoutMode === 'editorial-bottom') {
    // Documentary bottom gradient shelf so upper landscape remains crystal-clear
    const shelfTop = Math.min(height * 0.44, blockTopY - 84 * scale);
    const shelf = ctx.createLinearGradient(0, shelfTop, 0, height);
    shelf.addColorStop(0, 'rgba(6, 7, 11, 0)');
    shelf.addColorStop(0.28, 'rgba(6, 7, 11, 0.58)');
    shelf.addColorStop(1, 'rgba(6, 7, 11, 0.88)');
    ctx.fillStyle = shelf;
    ctx.fillRect(0, shelfTop, width, height - shelfTop);
  } else if (config.layoutMode === 'study-focus') {
    // Crisp high-contrast educational reading band for memorization & tajwid clarity
    const bandPadY = 48 * scale;
    const bandTop = Math.max(height * 0.17, blockTopY - bandPadY);
    const bandH = Math.min(height * 0.62, Math.max(240 * scale, blockBottomY - blockTopY + bandPadY * 2));
    const bandX = 52 * scale;
    const bandW = width - bandX * 2;

    ctx.globalAlpha = Math.max(0.5, opacity);
    ctx.fillStyle = lightSurface
      ? 'rgba(255, 253, 248, 0.86)'
      : 'rgba(12, 13, 18, 0.76)';
    ctx.beginPath();
    ctx.roundRect(bandX, bandTop, bandW, bandH, 24 * scale);
    ctx.fill();

    ctx.strokeStyle = lightSurface
      ? 'rgba(180, 131, 47, 0.34)'
      : 'rgba(212, 168, 83, 0.36)';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Wraps text into measured canvas lines using the active ctx.font.
 */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

/**
 * Computes per-line opacity for 'line-reveal' progressive line animation.
 */
function computeLineRevealAlpha(lineIdx: number, totalLines: number, verseProgress: number): number {
  if (totalLines <= 1) {
    return easeOutCubic(Math.min(1, verseProgress / 0.22));
  }
  const slotSpan = 0.72 / totalLines;
  const lineStart = 0.04 + lineIdx * slotSpan;
  const local = (verseProgress - lineStart) / Math.max(0.14, slotSpan * 1.15);
  return easeOutCubic(Math.max(0, Math.min(1, local)));
}

/**
 * Renders Arabic lines with karaoke, word reveal, line-by-line, mushaf-page, or fade animation.
 */
function drawArabicBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  ayahNumber: number,
  centerX: number,
  startY: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
  config: StudioConfig,
  verseProgress: number,
  opacity: number,
  lightSurface: boolean
): number {
  ctx.save();
  ctx.font = `700 ${fontSize}px ${getArabicFontStack(config.arabicFont)}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';

  const displayText =
    config.textAnimation === 'mushaf-page' || config.layoutMode === 'mushaf-frame'
      ? `${text} ﴿${toArabicIndicNumerals(ayahNumber)}﴾`
      : text;

  const lines = wrapCanvasText(ctx, displayText, maxWidth);
  const allWords = displayText.trim().split(/\s+/).filter(Boolean);
  const revealedWords = computeWordRevealCount(displayText, verseProgress, config.textAnimation);

  const baseShadowColor = lightSurface ? 'rgba(28, 22, 16, 0.09)' : 'rgba(0, 0, 0, 0.72)';
  const baseShadowBlur = lightSurface ? fontSize * 0.06 : fontSize * 0.25;
  const baseShadowOffsetY = lightSurface ? fontSize * 0.02 : fontSize * 0.06;

  let y = startY;
  let globalWordIdx = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineWords = line.split(/\s+/).filter(Boolean);

    if (config.textAnimation === 'luminous-reveal') {
      const visibleWords: string[] = [];
      let hasCurrent = false;
      for (let w = 0; w < lineWords.length; w++) {
        if (globalWordIdx < revealedWords) {
          visibleWords.push(lineWords[w]);
          if (globalWordIdx === revealedWords - 1 && revealedWords <= allWords.length) {
            hasCurrent = true;
          }
        }
        globalWordIdx++;
      }

      if (visibleWords.length > 0) {
        const visibleLine = visibleWords.join(' ');
        ctx.textAlign = 'center';
        ctx.globalAlpha = opacity;
        ctx.shadowColor =
          hasCurrent && !lightSurface ? 'rgba(212, 168, 83, 0.5)' : baseShadowColor;
        ctx.shadowBlur = hasCurrent && !lightSurface ? fontSize * 0.34 : baseShadowBlur;
        ctx.shadowOffsetY = baseShadowOffsetY;
        ctx.fillStyle = config.arabicColor;
        ctx.fillText(visibleLine, centerX, y);
      }
    } else if (config.textAnimation === 'karaoke' || config.textAnimation === 'mushaf-page') {
      const fullWidth = ctx.measureText(line).width;
      const spaceWidth = ctx.measureText(' ').width;
      let cursorX = centerX + fullWidth / 2;

      ctx.textAlign = 'right';
      for (let w = 0; w < lineWords.length; w++) {
        const word = lineWords[w];
        const wordW = ctx.measureText(word).width;
        const isRevealed = globalWordIdx < revealedWords;
        const isCurrent =
          globalWordIdx === revealedWords - 1 && revealedWords <= allWords.length;

        const dimFactor = config.textAnimation === 'mushaf-page' ? 0.62 : 0.46;
        ctx.globalAlpha = isRevealed ? opacity : opacity * dimFactor;
        ctx.shadowColor =
          isCurrent && !lightSurface ? 'rgba(212, 168, 83, 0.52)' : baseShadowColor;
        ctx.shadowBlur = isCurrent && !lightSurface ? fontSize * 0.34 : baseShadowBlur;
        ctx.shadowOffsetY = baseShadowOffsetY;
        ctx.fillStyle = isCurrent ? config.accentColor : config.arabicColor;

        ctx.fillText(word, cursorX, y);
        cursorX -= wordW + spaceWidth;
        globalWordIdx++;
      }
    } else if (config.textAnimation === 'mask-reveal') {
      // RTL geometric clip-mask reveal: preserves every Arabic ligature & diacritic intact
      const lineSpan = 0.76 / Math.max(1, lines.length);
      const lineStart = 0.04 + lineIdx * lineSpan;
      const lineReveal = easeOutCubic(
        Math.max(0, Math.min(1, (verseProgress - lineStart) / Math.max(0.16, lineSpan * 1.15)))
      );
      const lineW = ctx.measureText(line).width + fontSize * 0.6;
      const rightEdge = centerX + lineW / 2;
      const visibleW = lineW * lineReveal;

      ctx.save();
      ctx.beginPath();
      ctx.rect(rightEdge - visibleW, y - lineHeight * 0.65, visibleW + 4, lineHeight * 1.3);
      ctx.clip();
      ctx.globalAlpha = opacity;
      ctx.shadowColor = baseShadowColor;
      ctx.shadowBlur = baseShadowBlur;
      ctx.shadowOffsetY = baseShadowOffsetY;
      ctx.fillStyle = config.arabicColor;
      ctx.fillText(line, centerX, y);
      ctx.restore();
      globalWordIdx += lineWords.length;
    } else if (config.textAnimation === 'line-reveal') {
      const lineAlpha = computeLineRevealAlpha(lineIdx, lines.length, verseProgress);
      const liftY = (1 - lineAlpha) * (fontSize * 0.24);
      ctx.globalAlpha = opacity * lineAlpha;
      ctx.shadowColor = baseShadowColor;
      ctx.shadowBlur = baseShadowBlur;
      ctx.shadowOffsetY = baseShadowOffsetY;
      ctx.fillStyle = config.arabicColor;
      ctx.fillText(line, centerX, y + liftY);
      globalWordIdx += lineWords.length;
    } else {
      ctx.globalAlpha = opacity;
      ctx.shadowColor = baseShadowColor;
      ctx.shadowBlur = baseShadowBlur;
      ctx.shadowOffsetY = baseShadowOffsetY;
      ctx.fillStyle = config.arabicColor;
      ctx.fillText(line, centerX, y);
      globalWordIdx += lineWords.length;
    }

    y += lineHeight;
  }

  ctx.restore();
  return y;
}

/**
 * Renders French or English translation lines with matching animation & light/dark contrast.
 */
function drawTranslationBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
  config: StudioConfig,
  verseProgress: number,
  opacity: number,
  lightSurface: boolean,
  isSecondaryLanguage = false
): number {
  ctx.save();
  const fontStack = isSecondaryLanguage
    ? `italic 500 ${fontSize}px "Cormorant Garamond", Georgia, serif`
    : config.translationFont === 'editorial'
      ? `600 ${fontSize}px "Cormorant Garamond", Georgia, serif`
      : `500 ${fontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.font = fontStack;
  ctx.textBaseline = 'middle';
  ctx.direction = 'ltr';

  const lines = wrapCanvasText(ctx, text, maxWidth);
  const revealedWords = computeWordRevealCount(text, verseProgress, config.textAnimation);
  const baseShadowColor = lightSurface ? 'rgba(28, 22, 16, 0.06)' : 'rgba(0, 0, 0, 0.82)';
  const baseShadowBlur = lightSurface ? fontSize * 0.05 : fontSize * 0.34;
  const baseShadowOffsetY = lightSurface ? fontSize * 0.02 : fontSize * 0.08;
  const effectiveOpacity = isSecondaryLanguage ? opacity * 0.82 : opacity;

  let y = startY;
  let globalWordIdx = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineWords = line.split(/\s+/).filter(Boolean);

    if (config.textAnimation === 'luminous-reveal' && !isSecondaryLanguage) {
      const visibleWords: string[] = [];
      for (let w = 0; w < lineWords.length; w++) {
        if (globalWordIdx < revealedWords) {
          visibleWords.push(lineWords[w]);
        }
        globalWordIdx++;
      }

      if (visibleWords.length > 0) {
        ctx.textAlign = 'center';
        ctx.globalAlpha = effectiveOpacity;
        ctx.shadowColor = baseShadowColor;
        ctx.shadowBlur = baseShadowBlur;
        ctx.shadowOffsetY = baseShadowOffsetY;
        ctx.fillStyle = config.translationColor;
        ctx.fillText(visibleWords.join(' '), centerX, y);
      }
    } else if (
      (config.textAnimation === 'karaoke' || config.textAnimation === 'mushaf-page') &&
      !isSecondaryLanguage
    ) {
      const fullWidth = ctx.measureText(line).width;
      const spaceWidth = ctx.measureText(' ').width;
      let cursorX = centerX - fullWidth / 2;

      ctx.textAlign = 'left';
      for (let w = 0; w < lineWords.length; w++) {
        const word = lineWords[w];
        const wordW = ctx.measureText(word).width;
        const isRevealed = globalWordIdx < revealedWords;
        const isCurrent = globalWordIdx === revealedWords - 1;

        ctx.globalAlpha = isRevealed ? effectiveOpacity : effectiveOpacity * 0.52;
        ctx.shadowColor = baseShadowColor;
        ctx.shadowBlur = baseShadowBlur;
        ctx.shadowOffsetY = baseShadowOffsetY;
        ctx.fillStyle = isCurrent
          ? lightSurface
            ? config.accentColor
            : '#FFFFFF'
          : config.translationColor;

        ctx.fillText(word, cursorX, y);
        cursorX += wordW + spaceWidth;
        globalWordIdx++;
      }
    } else if (config.textAnimation === 'line-reveal') {
      const lineAlpha = computeLineRevealAlpha(lineIdx, lines.length, verseProgress);
      const liftY = (1 - lineAlpha) * (fontSize * 0.25);
      ctx.textAlign = 'center';
      ctx.globalAlpha = effectiveOpacity * lineAlpha;
      ctx.shadowColor = baseShadowColor;
      ctx.shadowBlur = baseShadowBlur;
      ctx.shadowOffsetY = baseShadowOffsetY;
      ctx.fillStyle = config.translationColor;
      ctx.fillText(line, centerX, y + liftY);
      globalWordIdx += lineWords.length;
    } else {
      ctx.textAlign = 'center';
      ctx.globalAlpha = effectiveOpacity;
      ctx.shadowColor = baseShadowColor;
      ctx.shadowBlur = baseShadowBlur;
      ctx.shadowOffsetY = baseShadowOffsetY;
      ctx.fillStyle = config.translationColor;
      ctx.fillText(line, centerX, y);
      globalWordIdx += lineWords.length;
    }

    y += lineHeight;
  }

  ctx.restore();
  return y;
}

/**
 * Draws optional TikTok safe-zone overlay (preview only, never exported).
 */
function drawTikTokSafeZone(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.save();
  const scale = width / 1080;

  ctx.fillStyle = 'rgba(212, 168, 83, 0.12)';
  ctx.strokeStyle = 'rgba(212, 168, 83, 0.55)';
  ctx.lineWidth = 2 * scale;
  ctx.setLineDash([10 * scale, 8 * scale]);

  const rightBarW = width * 0.16;
  const rightBarH = height * 0.34;
  const rightBarX = width - rightBarW - 20 * scale;
  const rightBarY = height * 0.48;
  ctx.fillRect(rightBarX, rightBarY, rightBarW, rightBarH);
  ctx.strokeRect(rightBarX, rightBarY, rightBarW, rightBarH);

  const bottomH = height * 0.18;
  const bottomY = height - bottomH;
  ctx.fillRect(0, bottomY, width, bottomH);
  ctx.strokeRect(0, bottomY, width, bottomH);

  const topH = height * 0.11;
  ctx.fillRect(0, 0, width, topH);
  ctx.strokeRect(0, 0, width, topH);

  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.84)';
  ctx.font = `600 ${22 * scale}px "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('Zone interface TikTok (boutons & légende)', width / 2, bottomY + bottomH * 0.52);

  ctx.restore();
}

/**
 * Main canvas frame renderer used for both live preview and HD/4K video export.
 */
export function renderStudioFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: PlaybackFrameState,
  scenes: SceneAsset[],
  mediaMap: LoadedMediaMap,
  config: StudioConfig,
  globalTime: number,
  isExport = false,
  audioLevel = 0
) {
  const scale = width / 1080;
  ctx.clearRect(0, 0, width, height);

  const primaryScene = scenes[frame.sceneIndex] ?? scenes[0];
  const nextScene = scenes[frame.nextSceneIndex] ?? primaryScene;
  const lightSurface = isLightComposition(config, primaryScene);

  // Opening hook zoom-settle over the first 1.2s
  const hookPhase = Math.min(1, Math.max(0, globalTime / 1.2));
  const hookZoom = 1 + (1 - easeOutCubic(hookPhase)) * 0.065 * config.motionIntensity;

  ctx.save();
  if (hookZoom > 1.0005) {
    ctx.translate(width / 2, height / 2);
    ctx.scale(hookZoom, hookZoom);
    ctx.translate(-width / 2, -height / 2);
  }

  // 1. Background scenic reel with Ken Burns, procedural 4K living animations, & cinematic transitions
  const hasTransition =
    frame.sceneBlend > 0.005 && nextScene && nextScene.id !== primaryScene?.id;
  const trans = hasTransition
    ? computeTransitionTransforms(frame.transitionStyle, frame.sceneBlend)
    : computeTransitionTransforms('crossfade', 0);

  const drawSingleScene = (
    scene: SceneAsset,
    seedIdx: number,
    alpha: number,
    extraScale: number,
    blurPx: number,
    offsetYRatio: number
  ) => {
    if (alpha <= 0.004) return;
    const offsetYPx = offsetYRatio * height;
    ctx.save();
    if (Math.abs(offsetYPx) > 0.5) {
      ctx.beginPath();
      ctx.rect(0, offsetYPx, width, height);
      ctx.clip();
      ctx.translate(0, offsetYPx);
    }
    if (extraScale !== 1) {
      ctx.translate(width / 2, height / 2);
      ctx.scale(extraScale, extraScale);
      ctx.translate(-width / 2, -height / 2);
    }
    if (blurPx > 0.25) {
      ctx.filter = `blur(${(blurPx * scale).toFixed(1)}px)`;
    }

    if (scene.type === 'generative') {
      ctx.save();
      ctx.globalAlpha = alpha;
      drawSacredNebulaBackdrop(ctx, width, height, globalTime, audioLevel, config.accentColor);
      ctx.restore();
    } else {
      drawSceneCover(
        ctx,
        mediaMap.get(scene.id),
        scene.fallbackGradient,
        width,
        height,
        globalTime,
        seedIdx,
        config.motionIntensity,
        alpha
      );
    }
    if (scene.animationLayer && scene.animationLayer !== 'none') {
      drawSceneAnimationLayer(
        ctx,
        scene.animationLayer,
        width,
        height,
        globalTime,
        audioLevel,
        alpha
      );
    }

    ctx.filter = 'none';
    ctx.restore();
  };

  if (primaryScene) {
    drawSingleScene(
      primaryScene,
      frame.sceneIndex + 1,
      trans.outgoingAlpha,
      trans.outgoingScale,
      trans.outgoingBlurPx,
      trans.outgoingOffsetY
    );
  }

  if (hasTransition && nextScene) {
    if (trans.incomingEdgeShadow > 0.01 && trans.incomingOffsetY > 0.002) {
      const seamY = trans.incomingOffsetY * height;
      const shadowH = 64 * scale;
      ctx.save();
      const edgeGrad = ctx.createLinearGradient(0, seamY - shadowH, 0, seamY);
      edgeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      edgeGrad.addColorStop(
        1,
        `rgba(0, 0, 0, ${(0.45 * trans.incomingEdgeShadow).toFixed(3)})`
      );
      ctx.fillStyle = edgeGrad;
      ctx.fillRect(0, seamY - shadowH, width, shadowH);
      ctx.restore();
    }

    drawSingleScene(
      nextScene,
      frame.nextSceneIndex + 1,
      trans.incomingAlpha,
      trans.incomingScale,
      trans.incomingBlurPx,
      trans.incomingOffsetY
    );
  }

  if (trans.overlayColor && trans.overlayAlpha > 0.005) {
    ctx.save();
    ctx.globalAlpha = trans.overlayAlpha;
    ctx.fillStyle = trans.overlayColor;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  ctx.restore();

  // 2. Scrim & atmosphere tuned separately for light paper vs dark cinematic surfaces
  if (lightSurface) {
    // Warm sunlit ivory wash rather than muddy dark scrim
    const lightWash = ctx.createRadialGradient(
      width / 2,
      height / 2,
      width * 0.28,
      width / 2,
      height / 2,
      height * 0.72
    );
    lightWash.addColorStop(0, 'rgba(252, 248, 240, 0.14)');
    lightWash.addColorStop(1, 'rgba(138, 114, 82, 0.16)');
    ctx.fillStyle = lightWash;
    ctx.fillRect(0, 0, width, height);
  } else {
    const scrimGrad = ctx.createLinearGradient(0, 0, 0, height);
    const baseScrim = config.scrimOpacity;
    scrimGrad.addColorStop(0, `rgba(6, 7, 11, ${Math.min(0.94, baseScrim * 0.9)})`);
    scrimGrad.addColorStop(0.34, `rgba(6, 7, 11, ${Math.min(0.88, baseScrim * 0.72)})`);
    scrimGrad.addColorStop(0.56, `rgba(6, 7, 11, ${Math.min(0.9, baseScrim * 0.78)})`);
    scrimGrad.addColorStop(1, `rgba(6, 7, 11, ${Math.min(0.96, baseScrim * 1.12)})`);
    ctx.fillStyle = scrimGrad;
    ctx.fillRect(0, 0, width, height);

    if (audioLevel > 0.02) {
      const voiceHalo = ctx.createRadialGradient(
        width / 2,
        height * config.verticalPosition,
        0,
        width / 2,
        height * config.verticalPosition,
        width * 0.65
      );
      voiceHalo.addColorStop(0, `rgba(212, 168, 83, ${Math.min(0.16, audioLevel * 0.14)})`);
      voiceHalo.addColorStop(1, 'rgba(212, 168, 83, 0)');
      ctx.fillStyle = voiceHalo;
      ctx.fillRect(0, 0, width, height);
    }

    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      width * 0.25,
      width / 2,
      height / 2,
      height * 0.68
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.44)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  // 3. Atmospheric particle layer
  drawParticles(ctx, config.particleEffect, width, height, globalTime, config.accentColor);

  // 4. Measure total verse block height before painting layout chrome
  const verse = frame.activeSegment.verse;
  const showArabic =
    config.subtitleLanguage === 'ar-fr' ||
    config.subtitleLanguage === 'ar-en' ||
    config.subtitleLanguage === 'ar-fr-en' ||
    config.subtitleLanguage === 'ar-only';
  const showPrimaryTranslation =
    config.subtitleLanguage === 'ar-fr' ||
    config.subtitleLanguage === 'ar-en' ||
    config.subtitleLanguage === 'ar-fr-en' ||
    config.subtitleLanguage === 'fr-only';
  const showSecondaryEnglish = config.subtitleLanguage === 'ar-fr-en' && Boolean(verse.english);

  const primaryTranslationText =
    config.subtitleLanguage === 'ar-en' ? verse.english : verse.french;

  const maxTextWidth =
    config.layoutMode === 'mushaf-frame'
      ? width * 0.52
      : config.layoutMode === 'study-focus'
        ? width * 0.74
        : width * 0.82;

  const arabicFontPx = config.arabicFontSize * scale;
  const arabicLineH = arabicFontPx * 1.65;
  const transFontPx = config.translationFontSize * scale;
  const transLineH = transFontPx * 1.46;
  const secondaryFontPx = Math.max(22, config.translationFontSize * 0.78) * scale;
  const secondaryLineH = secondaryFontPx * 1.42;

  const arabicDisplayText =
    config.textAnimation === 'mushaf-page' || config.layoutMode === 'mushaf-frame'
      ? `${verse.arabic} ﴿${toArabicIndicNumerals(verse.ayahNumber)}﴾`
      : verse.arabic;

  let arabicLineCount = 0;
  if (showArabic) {
    ctx.save();
    ctx.font = `700 ${arabicFontPx}px ${getArabicFontStack(config.arabicFont)}`;
    arabicLineCount = wrapCanvasText(ctx, arabicDisplayText, maxTextWidth).length;
    ctx.restore();
  }

  let primaryTransLines = 0;
  if (showPrimaryTranslation && primaryTranslationText) {
    ctx.save();
    ctx.font =
      config.translationFont === 'editorial'
        ? `600 ${transFontPx}px "Cormorant Garamond", Georgia, serif`
        : `500 ${transFontPx}px "Plus Jakarta Sans", system-ui, sans-serif`;
    primaryTransLines = wrapCanvasText(ctx, primaryTranslationText, maxTextWidth).length;
    ctx.restore();
  }

  let secondaryTransLines = 0;
  if (showSecondaryEnglish) {
    ctx.save();
    ctx.font = `italic 500 ${secondaryFontPx}px "Cormorant Garamond", Georgia, serif`;
    secondaryTransLines = wrapCanvasText(ctx, verse.english, maxTextWidth).length;
    ctx.restore();
  }

  const ornamentGap = showArabic && showPrimaryTranslation ? 60 * scale : 0;
  const secondaryGap = showSecondaryEnglish ? 20 * scale : 0;
  const totalBlockH =
    arabicLineCount * arabicLineH +
    ornamentGap +
    primaryTransLines * transLineH +
    secondaryGap +
    secondaryTransLines * secondaryLineH;

  let riseOffsetY = 0;
  if (config.textAnimation === 'vertical-rise') {
    const enter = easeOutCubic(Math.min(1, frame.verseProgress * 3.5));
    riseOffsetY = (1 - enter) * 44 * scale;
  } else {
    const enter = easeOutCubic(Math.min(1, frame.verseProgress * 4));
    riseOffsetY = (1 - enter) * 14 * scale;
  }

  const anchorFraction =
    config.layoutMode === 'editorial-bottom'
      ? Math.max(0.58, config.verticalPosition)
      : config.verticalPosition;

  const blockStartY = height * anchorFraction - totalBlockH / 2 + riseOffsetY;
  const blockEndY = blockStartY + totalBlockH;
  const textOpacity = frame.fadeFactor;

  // 5. Layout-specific framing chrome (Mushaf illuminated frame, Obsidian hairlines, Study band, Editorial shelf)
  drawLayoutChrome(
    ctx,
    width,
    height,
    config,
    lightSurface,
    scale,
    blockStartY,
    blockEndY,
    textOpacity
  );

  // 6. Surah header (adapted per layout mode)
  if (config.showSurahHeader) {
    ctx.save();
    const headerY = config.layoutMode === 'mushaf-frame' ? height * 0.148 : height * 0.145;
    ctx.globalAlpha = lightSurface ? 0.92 : 0.88;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = config.accentColor;
    ctx.font = `600 ${24 * scale}px "Outfit", system-ui, sans-serif`;
    const repeatTag =
      config.memorizationRepeat > 1 && verse.repeatPass
        ? `  ·  RÉP. ${verse.repeatPass}/${config.memorizationRepeat}`
        : '';
    const headerLabel = `SOURATE ${verse.surahNameFr.toUpperCase()}  ·  ${verse.surahNumber}:${verse.ayahNumber}${repeatTag}`;

    if (config.layoutMode === 'mushaf-frame') {
      // Illuminated Surah cartouche pill inside the manuscript top margin
      const labelW = ctx.measureText(headerLabel).width + 64 * scale;
      const boxH = 54 * scale;
      ctx.strokeStyle = config.accentColor;
      ctx.lineWidth = 1.6 * scale;
      ctx.fillStyle = lightSurface
        ? 'rgba(248, 241, 224, 0.82)'
        : 'rgba(18, 14, 10, 0.72)';
      ctx.beginPath();
      ctx.roundRect(width / 2 - labelW / 2, headerY - boxH / 2, labelW, boxH, 27 * scale);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = config.accentColor;
      ctx.fillText(headerLabel, width / 2, headerY + 1 * scale);
    } else {
      ctx.fillText(headerLabel, width / 2, headerY);

      ctx.strokeStyle = lightSurface
        ? 'rgba(154, 111, 37, 0.34)'
        : 'rgba(212, 168, 83, 0.32)';
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.moveTo(width / 2 - 70 * scale, headerY + 28 * scale);
      ctx.lineTo(width / 2 + 70 * scale, headerY + 28 * scale);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Dynamic focus contextual ghost verses (previous above, next below)
  if (config.textAnimation === 'dynamic-focus' && showArabic) {
    ctx.save();
    const ctxFontSize = Math.max(30, arabicFontPx * 0.58);
    ctx.font = `400 ${ctxFontSize}px ${getArabicFontStack(config.arabicFont)}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillStyle = config.arabicColor;
    ctx.globalAlpha = (lightSurface ? 0.28 : 0.24) * textOpacity;

    if (frame.prevArabic) {
      const prevLine = wrapCanvasText(ctx, frame.prevArabic, maxTextWidth)[0];
      if (prevLine) {
        ctx.fillText(prevLine, width / 2, Math.max(height * 0.22, blockStartY - 62 * scale));
      }
    }
    if (frame.nextArabic) {
      const nextLine = wrapCanvasText(ctx, frame.nextArabic, maxTextWidth)[0];
      if (nextLine) {
        ctx.fillText(nextLine, width / 2, Math.min(height * 0.72, blockEndY + 62 * scale));
      }
    }
    ctx.restore();
  }

  // 7. Render Arabic + Primary Translation + Optional Trilingual English Subtitle
  let cursorY = blockStartY;
  let arabicBottomY = cursorY;

  if (showArabic) {
    const nextArabicCenterY = drawArabicBlock(
      ctx,
      verse.arabic,
      verse.ayahNumber,
      width / 2,
      cursorY + arabicLineH * 0.5,
      maxTextWidth,
      arabicFontPx,
      arabicLineH,
      config,
      frame.verseProgress,
      textOpacity,
      lightSurface
    );
    arabicBottomY = nextArabicCenterY - arabicLineH * 0.5;
    cursorY = arabicBottomY;
  }

  if (showArabic && showPrimaryTranslation && config.showOrnament) {
    const divY = arabicBottomY + ornamentGap * 0.48;
    ctx.save();
    ctx.globalAlpha = textOpacity * 0.72;
    ctx.strokeStyle = config.accentColor;
    ctx.fillStyle = config.accentColor;
    ctx.lineWidth = 1.5 * scale;

    ctx.beginPath();
    ctx.moveTo(width / 2 - 96 * scale, divY);
    ctx.lineTo(width / 2 - 14 * scale, divY);
    ctx.moveTo(width / 2 + 14 * scale, divY);
    ctx.lineTo(width / 2 + 96 * scale, divY);
    ctx.stroke();

    const d = 5.5 * scale;
    ctx.beginPath();
    ctx.moveTo(width / 2, divY - d);
    ctx.lineTo(width / 2 + d, divY);
    ctx.lineTo(width / 2, divY + d);
    ctx.lineTo(width / 2 - d, divY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  if (showPrimaryTranslation && primaryTranslationText) {
    const transStartY = showArabic
      ? arabicBottomY + ornamentGap + transLineH * 0.5
      : cursorY + transLineH * 0.5;
    const nextTransCenterY = drawTranslationBlock(
      ctx,
      primaryTranslationText,
      width / 2,
      transStartY,
      maxTextWidth,
      transFontPx,
      transLineH,
      config,
      frame.verseProgress,
      textOpacity,
      lightSurface,
      false
    );
    cursorY = nextTransCenterY - transLineH * 0.5;
  }

  if (showSecondaryEnglish) {
    const secStartY = cursorY + secondaryGap + secondaryLineH * 0.5;
    const nextSecCenterY = drawTranslationBlock(
      ctx,
      verse.english,
      width / 2,
      secStartY,
      maxTextWidth,
      secondaryFontPx,
      secondaryLineH,
      config,
      frame.verseProgress,
      textOpacity,
      lightSurface,
      true
    );
    cursorY = nextSecCenterY - secondaryLineH * 0.5;
  }

  // 8. Optional subtle organic audio waveform indicator below text
  if (config.showAudioWave) {
    ctx.save();
    const barCount = 19;
    const barGap = 9 * scale;
    const barW = 3.5 * scale;
    const totalWaveW = (barCount - 1) * barGap;
    const startX = width / 2 - totalWaveW / 2;
    const waveY = Math.min(height * 0.745, cursorY + 46 * scale);

    ctx.fillStyle = config.accentColor;
    const voiceBoost = audioLevel > 0.01 ? 0.35 + audioLevel * 1.45 : 0.72;
    for (let i = 0; i < barCount; i++) {
      const distFromCenter = Math.abs(i - (barCount - 1) / 2) / ((barCount - 1) / 2);
      const envelope = 1 - distFromCenter * 0.7;
      const harmonic =
        0.28 +
        0.72 *
          Math.abs(
            Math.sin(globalTime * 4.6 + i * 0.68) *
              Math.cos(globalTime * 2.3 - i * 0.38)
          );
      const barH = (6 + 30 * envelope * harmonic * voiceBoost) * scale;
      ctx.globalAlpha = (0.34 + 0.5 * envelope) * Math.max(0.4, textOpacity);
      ctx.beginPath();
      ctx.roundRect(startX + i * barGap - barW / 2, waveY - barH / 2, barW, barH, 2 * scale);
      ctx.fill();
    }
    ctx.restore();
  }

  // 9. Creator watermark positioned safely above the TikTok caption zone
  const footerY = height * 0.795;
  if (config.watermark.trim()) {
    ctx.save();
    ctx.globalAlpha = lightSurface ? 0.74 : 0.65;
    ctx.fillStyle = lightSurface ? '#3F3F46' : '#E4E4E7';
    ctx.font = `500 ${23 * scale}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.watermark.trim(), width / 2, footerY);
    ctx.restore();
  }

  // Subtle thin timeline bar at very bottom edge
  const overallProgress =
    frame.totalDuration > 0
      ? Math.min(1, (frame.activeSegment.startTime + frame.verseElapsed) / frame.totalDuration)
      : 0;
  ctx.save();
  ctx.fillStyle = lightSurface ? 'rgba(24, 24, 27, 0.14)' : 'rgba(255, 255, 255, 0.14)';
  ctx.fillRect(0, height - 5 * scale, width, 5 * scale);
  ctx.fillStyle = config.accentColor;
  ctx.fillRect(0, height - 5 * scale, width * overallProgress, 5 * scale);
  ctx.restore();

  // 10. Preview-only TikTok safe-zone guides
  if (!isExport && config.showTikTokSafeZone) {
    drawTikTokSafeZone(ctx, width, height);
  }
}
