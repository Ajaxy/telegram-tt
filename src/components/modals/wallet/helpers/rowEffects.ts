export const ROW_STARS_DURATION = 1.25;

const STAR_COUNT = 34;
const STAR_SEED = 31;
const STAR_DRAG = 2.6;
const STAR_SPREAD_Y = 0.45;
const STAR_TONES = ['48,161,245', '92,204,255', '33,120,247'];
const STAR_POINTS = 4;
// Shares of the star's life and size
const STAR_FADE_IN = 0.12;
const STAR_SHRINK = 0.45;
const STAR_TWINKLE = 0.28;
const STAR_TWINKLE_SPEED = 19;
const STAR_SPIN = 2.4;
const STAR_REACH = 1.5;
const STAR_WAIST = 0.18;
const STAR_HALO_SIZE = 2.4;
const STAR_HALO_ALPHA = 0.28;
// Half the stars fly back along the row within this angle, the rest in any direction
const STAR_BACK_SPREAD = 0.75;
const STAR_SPEED_RANGE = [160, 760] as const;
const STAR_SIZE_RANGE = [2.6, 6.2] as const;
const STAR_LIFE_RANGE = [0.6, 1.15] as const;
const STAR_MAX_DELAY = 0.09;
// The linear congruential generator of Numerical Recipes
const LCG_MULTIPLIER = 1664525;
const LCG_INCREMENT = 1013904223;
const UINT32_RANGE = 2 ** 32;
const STARS = buildStars();

type Star = {
  angle: number;
  speed: number;
  size: number;
  life: number;
  delay: number;
  phase: number;
  tone: number;
};

// Four-point stars fly out of the diamond along the row, fast at first, then brake and fade
export function drawStarBurst(context: CanvasRenderingContext2D, time: number, origin: { x: number; y: number }) {
  if (time <= 0) return;

  STARS.forEach((star) => {
    const age = time - star.delay;
    if (age <= 0 || age >= star.life) return;

    const progress = age / star.life;
    const distance = (star.speed * (1 - Math.exp(-STAR_DRAG * age))) / STAR_DRAG;
    const x = origin.x + Math.cos(star.angle) * distance;
    const y = origin.y + Math.sin(star.angle) * distance * STAR_SPREAD_Y;
    const fade = Math.min(1, progress / STAR_FADE_IN) * (1 - progress * progress);
    const twinkle = 1 - STAR_TWINKLE + STAR_TWINKLE * Math.sin(age * STAR_TWINKLE_SPEED + star.phase);
    const size = star.size * (1 - STAR_SHRINK * progress) * twinkle;
    const rgb = STAR_TONES[star.tone];

    const haloRadius = STAR_HALO_SIZE * size;
    const halo = context.createRadialGradient(x, y, 0, x, y, haloRadius);
    halo.addColorStop(0, `rgba(${rgb},${STAR_HALO_ALPHA * fade})`);
    halo.addColorStop(1, `rgba(${rgb},0)`);
    context.fillStyle = halo;
    context.fillRect(x - haloRadius, y - haloRadius, 2 * haloRadius, 2 * haloRadius);

    const rotation = star.phase + age * STAR_SPIN;
    const reach = size * STAR_REACH;
    context.beginPath();
    context.moveTo(x + Math.cos(rotation) * reach, y + Math.sin(rotation) * reach);
    for (let i = 1; i <= STAR_POINTS; i++) {
      const angle = rotation + (i * 2 * Math.PI) / STAR_POINTS;
      const control = angle - Math.PI / STAR_POINTS;
      context.quadraticCurveTo(
        x + Math.cos(control) * reach * STAR_WAIST,
        y + Math.sin(control) * reach * STAR_WAIST,
        x + Math.cos(angle) * reach,
        y + Math.sin(angle) * reach,
      );
    }
    context.closePath();
    context.fillStyle = `rgba(${rgb},${fade})`;
    context.fill();
  });
}

// Every salute has the same stars, from a seeded generator
function buildStars(): Star[] {
  let seed = STAR_SEED;

  function getRandom(from: number, to: number) {
    seed = (Math.imul(seed, LCG_MULTIPLIER) + LCG_INCREMENT) >>> 0;
    return from + ((to - from) * seed) / UINT32_RANGE;
  }

  return Array.from({ length: STAR_COUNT }, (_, i) => ({
    angle: i % 2 === 0 ? Math.PI + getRandom(-STAR_BACK_SPREAD, STAR_BACK_SPREAD) : getRandom(0, 2 * Math.PI),
    speed: getRandom(...STAR_SPEED_RANGE),
    size: getRandom(...STAR_SIZE_RANGE),
    life: getRandom(...STAR_LIFE_RANGE),
    delay: getRandom(0, STAR_MAX_DELAY),
    phase: getRandom(0, 2 * Math.PI),
    tone: Math.floor(getRandom(0, STAR_TONES.length)),
  }));
}
