import type { ElementRef } from '../../lib/teact/teact';
import { memo, useEffect, useRef } from '../../lib/teact/teact';

import { useStateRef } from '../../hooks/useStateRef';

import Portal from '../ui/Portal';

import styles from './WishParticles.module.scss';

type OwnProps = {
  burstId: number;
  amountGram: number;
  targetRef: ElementRef<HTMLElement>;
  onArrive: (valueGram: number, isFirst: boolean) => void;
  onEnd: NoneToVoidFunction;
};

type Particle = {
  // Progress of the flight; negative while the particle waits for its stagger
  time: number;
  startX: number;
  controlX: number;
  isFirst: boolean;
};

const MAX_PARTICLES = 14;
const EXTRA_PARTICLES = 3;
const STAGGER_MS = 70;
const FLIGHT_MS = 900;
const MAX_FRAME_MS = 50;
const START_SPREAD = 0.5;
const CONTROL_SPREAD = 0.9;
const START_OFFSET_Y = 20;
const PARTICLE_HALF_WIDTH = 6;
const PARTICLE_HALF_HEIGHT = 8;
const PARTICLE_GLOW = 12;
const MAX_PIXEL_RATIO = 2;

// Diamonds fly from the bottom of the viewport along quadratic curves to wherever the crystal is in each frame
const WishParticles = ({
  burstId, amountGram, targetRef, onArrive, onEnd,
}: OwnProps) => {
  const canvasRef = useRef<HTMLCanvasElement>();
  const onArriveRef = useStateRef(onArrive);
  const onEndRef = useStateRef(onEnd);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const { innerWidth: width, innerHeight: height } = window;
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const count = Math.min(MAX_PARTICLES, Math.ceil(amountGram) + EXTRA_PARTICLES);
    const valueGram = amountGram / count;
    let particles: Particle[] = Array.from({ length: count }, (_, i) => ({
      time: (-i * STAGGER_MS) / FLIGHT_MS,
      startX: width / 2 + (Math.random() - 0.5) * width * START_SPREAD,
      controlX: width / 2 + (Math.random() - 0.5) * width * CONTROL_SPREAD,
      isFirst: i === 0,
    }));

    let lastTime = performance.now();
    let frameId = requestAnimationFrame(tick);

    function tick(now: number) {
      const elapsed = Math.min(MAX_FRAME_MS, now - lastTime);
      lastTime = now;

      const rect = targetRef.current?.getBoundingClientRect();
      const endX = rect ? rect.left + rect.width / 2 : width / 2;
      const endY = rect ? rect.top + rect.height / 2 : height / 2;
      const controlY = (height + endY) / 2;

      ctx.clearRect(0, 0, width, height);
      particles = particles.filter((particle) => {
        particle.time += elapsed / FLIGHT_MS;
        if (particle.time < 0) return true;

        if (particle.time >= 1) {
          onArriveRef.current(valueGram, particle.isFirst);
          navigator.vibrate?.(10);
          return false;
        }

        // Smoothstep easing on a quadratic Bézier curve
        const t = particle.time;
        const eased = t * t * (3 - 2 * t);
        const rest = 1 - eased;
        const x = rest * rest * particle.startX + 2 * rest * eased * particle.controlX + eased * eased * endX;
        const y = rest * rest * (height + START_OFFSET_Y) + 2 * rest * eased * controlY + eased * eased * endY;
        drawParticle(ctx, x, y);
        return true;
      });

      if (particles.length) {
        frameId = requestAnimationFrame(tick);
      } else {
        onEndRef.current();
      }
    }

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [amountGram, burstId, onArriveRef, onEndRef, targetRef]);

  return (
    <Portal>
      <canvas ref={canvasRef} className={styles.root} />
    </Portal>
  );
};

function drawParticle(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.shadowColor = '#4cc3ff';
  ctx.shadowBlur = PARTICLE_GLOW;
  ctx.fillStyle = '#8be0ff';
  ctx.beginPath();
  ctx.moveTo(x, y - PARTICLE_HALF_HEIGHT);
  ctx.lineTo(x + PARTICLE_HALF_WIDTH, y);
  ctx.lineTo(x, y + PARTICLE_HALF_HEIGHT);
  ctx.lineTo(x - PARTICLE_HALF_WIDTH, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export default memo(WishParticles);
