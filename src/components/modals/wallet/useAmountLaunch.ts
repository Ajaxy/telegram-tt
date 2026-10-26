import {
  type ElementRef, useEffect, useRef, useState,
} from '../../../lib/teact/teact';

import type StandaloneDiamond from '../../../lib/diamond/standalone';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { getPop } from './helpers/amountFrames';
import { sampleFrames } from './helpers/motion';
import { AMOUNT_DIAMOND_SPIN, setSendLaunch } from './helpers/sendFlight';

import { useStateRef } from '../../../hooks/useStateRef';

const LAUNCH_KICK = -10;
const LAUNCH_KICK_DECAY = 0.9;
const LAUNCH_SPIN = 10;
const LAUNCH_SWAY = 1.6;
const LAUNCH_RAMP = 0.45;
const LAUNCH_RAMP_EXPONENT = 0.65;
const LAUNCH_SWELL = 0.35;
const LAUNCH_BREATH = 0.03;
const LAUNCH_BREATH_FREQUENCY = 1.1;
const LAUNCH_MIN_STARS = 0.6;
const LAUNCH_BURST_TIMES = [0.03, 0.45];
const LAUNCH_VIBRATION = 15;
const GLOW_OPACITY = 0.22;
const RING_DELAY = 20;
const RING_DURATION = 700;
const RING_START_SCALE = 1.2;
const RING_GROWTH = 3;
const RING_SPREAD_EXPONENT = 2.4;
const RING_BLUR_GROWTH = 3;
const GLOW_FRAMES = sampleFrames(LAUNCH_RAMP * 1000, (_, t) => ({ opacity: GLOW_OPACITY * t ** LAUNCH_RAMP_EXPONENT }));
const RING_FRAMES = buildRingFrames();

// Sending charges the diamond: a hit, a spin-up and two salutes. It leaves for the history once queued.
export default function useAmountLaunch(
  diamondRef: ElementRef<StandaloneDiamond>, isLaunching: boolean | undefined, isActive: boolean,
) {
  const glowRef = useRef<HTMLSpanElement>();
  const ringRef = useRef<HTMLSpanElement>();
  const isActiveRef = useStateRef(isActive);
  const [hitKey, setHitKey] = useState(0);

  useEffect(() => {
    const diamond = diamondRef.current;
    if (!isLaunching || !isActiveRef.current || !diamond) return undefined;

    const glow = glowRef.current;
    const startedAt = performance.now();
    let burstCount = 0;
    let frameId = 0;

    diamond.kick(LAUNCH_KICK, LAUNCH_KICK_DECAY);
    navigator.vibrate?.(LAUNCH_VIBRATION);
    setHitKey((key) => key + 1);
    setSendLaunch(diamond);
    requestMutation(() => {
      glow?.animate(GLOW_FRAMES, { duration: LAUNCH_RAMP * 1000, fill: 'forwards' });
      ringRef.current?.animate(RING_FRAMES, { duration: RING_DURATION, delay: RING_DELAY });
    });

    function tick() {
      const time = (performance.now() - startedAt) / 1000;
      const energy = Math.min(time / LAUNCH_RAMP, 1) ** LAUNCH_RAMP_EXPONENT;
      const breath = Math.sin(2 * Math.PI * LAUNCH_BREATH_FREQUENCY * time);

      diamond!.speed = AMOUNT_DIAMOND_SPIN + (LAUNCH_SPIN - AMOUNT_DIAMOND_SPIN) * energy;
      diamond!.setSway(1 + LAUNCH_SWAY * energy);
      diamond!.starOpacity = Math.max(energy, LAUNCH_MIN_STARS);
      diamond!.setScale(1 + LAUNCH_SWELL * getPop(time * 1000) + LAUNCH_BREATH * energy * breath);
      if (burstCount < LAUNCH_BURST_TIMES.length && time > LAUNCH_BURST_TIMES[burstCount]) {
        diamond!.burst();
        burstCount++;
      }

      // The screen stays mounted after it is left, so the loop stops with it
      if (isActiveRef.current) frameId = requestAnimationFrame(tick);
    }

    tick();

    return () => {
      cancelAnimationFrame(frameId);
      setSendLaunch(undefined);
      diamond.speed = AMOUNT_DIAMOND_SPIN;
      diamond.setSway(1);
      diamond.starOpacity = 1;
      diamond.isStoneHidden = false;
      diamond.setScale(1, true);
      requestMutation(() => {
        glow?.getAnimations().forEach((animation) => animation.cancel());
      });
    };
  }, [isLaunching, diamondRef, isActiveRef]);

  return { glowRef, ringRef, hitKey };
}

function buildRingFrames(): Keyframe[] {
  return sampleFrames(RING_DURATION, (_, t) => {
    const spread = 1 - (1 - t) ** RING_SPREAD_EXPONENT;

    return {
      opacity: 1 - spread,
      transform: `scale(${RING_START_SCALE + RING_GROWTH * spread})`,
      filter: `blur(${1 + RING_BLUR_GROWTH * spread}px)`,
    };
  });
}
