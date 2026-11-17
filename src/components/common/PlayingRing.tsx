import { useEffect, useRef } from '../../lib/teact/teact';

import { requestMutation } from '../../lib/fasterdom/fasterdom';
import { getCurrentTrackAnalyser } from '../../util/audioPlayback/audioAnalyser';
import buildClassName from '../../util/buildClassName';
import { fastRaf } from '../../util/schedulers';

import useLang from '../../hooks/useLang';

import styles from './PlayingRing.module.scss';

type OwnProps = {
  withCutout?: boolean;
  isPaused?: boolean;
  className?: string;
};

const TICK_COUNT = 52;
const CENTER = 34;
const INNER_RADIUS = 26;

const MIN_TICK_LENGTH = 0.4;
const MAX_TICK_LENGTH = 6;
const MIN_FREQUENCY = 31.5;
const MAX_FREQUENCY = 16000;
const HIGH_FREQUENCY_BOOST = 0.5;
const LOUDNESS_EXPONENT = 1.4;
const SYNTHETIC_BASE = 0.35;
const HALF_TICK_COUNT = TICK_COUNT / 2;
const NYQUIST_DIVISOR = 2;
const MS_IN_SECOND = 1000;
const MAX_BYTE_VALUE = 255;
const SYNTHETIC_WAVES: [amplitude: number, speed: number, spread: number][] = [[0.3, 2.4, 0.35], [0.2, -1.3, 0.6]];
const TICK_EASING = 0.22;
const SETTLED_THRESHOLD = 0.005;

const ANGLES = Array.from({ length: TICK_COUNT }, (_, i) => (360 / TICK_COUNT) * i);

function buildBands(binCount: number, sampleRate: number) {
  const binWidth = sampleRate / NYQUIST_DIVISOR / binCount;

  return ANGLES.map((_, i) => {
    const positionInHalf = (i < HALF_TICK_COUNT ? i : TICK_COUNT - i) / HALF_TICK_COUNT;
    const frequency = MIN_FREQUENCY * (MAX_FREQUENCY / MIN_FREQUENCY) ** positionInHalf;

    return {
      bin: Math.min(binCount - 1, Math.round(frequency / binWidth)),
      gain: 1 + HIGH_FREQUENCY_BOOST * positionInHalf,
    };
  });
}

function fillSyntheticLoudness(loudness: Float32Array) {
  const time = performance.now() / MS_IN_SECOND;

  for (let i = 0; i < loudness.length; i++) {
    const wave = SYNTHETIC_WAVES.reduce((sum, [amplitude, speed, spread]) => (
      sum + amplitude * Math.sin(time * speed + i * spread)
    ), SYNTHETIC_BASE);
    loudness[i] = Math.min(1, Math.max(0, wave));
  }
}

const PlayingRing = ({ withCutout, isPaused, className }: OwnProps) => {
  const lang = useLang();

  const ticksRef = useRef<SVGGElement>();
  const loudnessRef = useRef(new Float32Array(TICK_COUNT));

  useEffect(() => {
    const container = ticksRef.current;
    if (!container) return undefined;

    const lines = container.querySelectorAll('line');
    const loudness = loudnessRef.current;
    const target = new Float32Array(TICK_COUNT);
    let data: Uint8Array<ArrayBuffer> | undefined;
    let bands: { bin: number; gain: number }[] | undefined;
    let isUnmounted = false;

    const applyLoudness = () => {
      if (isUnmounted) return;

      for (let i = 0; i < lines.length; i++) {
        const length = MIN_TICK_LENGTH + loudness[i] * (MAX_TICK_LENGTH - MIN_TICK_LENGTH);
        lines[i].setAttribute('y2', String(CENTER - INNER_RADIUS - length));
      }
    };

    const fillTarget = () => {
      if (isPaused) {
        target.fill(0);
        return;
      }

      const analyser = getCurrentTrackAnalyser();
      if (!analyser) {
        fillSyntheticLoudness(target);
        return;
      }

      if (!data || data.length !== analyser.frequencyBinCount) {
        data = new Uint8Array(analyser.frequencyBinCount);
        bands = buildBands(analyser.frequencyBinCount, analyser.context.sampleRate);
      }

      analyser.getByteFrequencyData(data);

      for (let i = 0; i < target.length; i++) {
        const { bin, gain } = bands![i];
        target[i] = Math.min(1, (data[bin] / MAX_BYTE_VALUE) ** LOUDNESS_EXPONENT * gain);
      }
    };

    const renderFrame = () => {
      if (isUnmounted) return;
      fillTarget();

      let isSettled = true;
      for (let i = 0; i < loudness.length; i++) {
        loudness[i] += (target[i] - loudness[i]) * TICK_EASING;
        if (Math.abs(target[i] - loudness[i]) > SETTLED_THRESHOLD) isSettled = false;
      }

      if (isPaused && isSettled) {
        loudness.fill(0);
        requestMutation(applyLoudness);
        return;
      }

      requestMutation(applyLoudness);
      fastRaf(renderFrame);
    };

    fastRaf(renderFrame);

    return () => {
      isUnmounted = true;
    };
  }, [isPaused]);

  return (
    <svg
      className={buildClassName(
        styles.root, withCutout && styles.withCutout, withCutout && lang.isRtl && styles.rtl, className,
      )}
      viewBox="0 0 68 68"
      aria-hidden
    >
      <g ref={ticksRef}>
        {ANGLES.map((angle) => (
          <g key={angle} transform={`rotate(${angle} ${CENTER} ${CENTER})`}>
            <line
              className={styles.tick}
              x1={CENTER}
              y1={CENTER - INNER_RADIUS}
              x2={CENTER}
              y2={CENTER - INNER_RADIUS - MIN_TICK_LENGTH}
            />
          </g>
        ))}
      </g>
    </svg>
  );
};

export default PlayingRing;
