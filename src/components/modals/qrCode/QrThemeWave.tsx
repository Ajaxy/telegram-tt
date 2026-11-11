import type { ElementRef } from '../../../lib/teact/teact';
import { memo, useLayoutEffect, useRef } from '../../../lib/teact/teact';

import type { Point } from './helpers/floatingLayer';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { animate } from '../../../util/animation';
import buildClassName from '../../../util/buildClassName';
import {
  buildWaveRing, getWaveMaxRadius, getWaveRadius, WAVE_DURATION,
} from './helpers/themeWave';

import useForceUpdate from '../../../hooks/useForceUpdate';
import usePrevious from '../../../hooks/usePrevious';
import { useStateRef } from '../../../hooks/useStateRef';

import styles from './QrThemeWave.module.scss';

type OwnProps = {
  activeKey: number;
  startedAt?: number;
  ringColor: string;
  originRef: ElementRef<HTMLDivElement>;
  className?: string;
  children: React.ReactNode;
};

const HIDDEN_SLIDE_STYLE = 'clip-path: circle(0 at 50% 50%)';

// Reveals a new scene over the previous one with a circle growing from the card
const QrThemeWave = ({
  activeKey,
  startedAt,
  ringColor,
  originRef,
  className,
  children,
}: OwnProps) => {
  const rootRef = useRef<HTMLDivElement>();
  const ringRef = useRef<HTMLDivElement>();
  const rendersRef = useRef<Record<number, React.ReactNode>>({});
  const prevKey = usePrevious(activeKey);
  const ringColorRef = useStateRef(ringColor);
  const forceUpdate = useForceUpdate();

  if (!(activeKey in rendersRef.current)) {
    rendersRef.current = prevKey !== undefined && prevKey in rendersRef.current
      ? { [prevKey]: rendersRef.current[prevKey] }
      : {};
  }
  rendersRef.current[activeKey] = children;

  const keys = Object.keys(rendersRef.current).map(Number);
  const isWaving = keys.length > 1;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !startedAt || Object.keys(rendersRef.current).length < 2) return undefined;

    let isCancelled = false;

    animate(() => {
      if (isCancelled) return false;

      const elapsed = performance.now() - startedAt;
      const rootRect = root.getBoundingClientRect();
      const originRect = originRef.current?.getBoundingClientRect();
      // Client rects include the modal's opening scale
      const ratio = root.offsetWidth ? rootRect.width / root.offsetWidth : 1;
      const area = {
        left: 0, top: 0, width: root.offsetWidth, height: root.offsetHeight,
      };
      const origin: Point = originRect ? {
        x: (originRect.left + originRect.width / 2 - rootRect.left) / ratio,
        y: (originRect.top + originRect.height / 2 - rootRect.top) / ratio,
      } : { x: area.width / 2, y: area.height / 2 };
      const radius = getWaveRadius(elapsed, getWaveMaxRadius(area, origin));
      const isFinished = elapsed >= WAVE_DURATION;

      requestMutation(() => {
        if (isCancelled) return;

        const slide = root.querySelector<HTMLElement>(`[data-wave-key="${activeKey}"]`);
        const ring = ringRef.current;
        if (slide && !isFinished) {
          slide.style.clipPath = `circle(${radius.toFixed(1)}px at ${origin.x.toFixed(1)}px ${origin.y.toFixed(1)}px)`;
        }
        if (ring) {
          ring.style.background = (!isFinished && buildWaveRing(origin, radius, elapsed, ringColorRef.current)) || '';
        }
      });

      if (isFinished) {
        rendersRef.current = { [activeKey]: rendersRef.current[activeKey] };
        forceUpdate();
        return false;
      }

      return true;
    }, requestMeasure);

    return () => {
      isCancelled = true;
    };
  }, [activeKey, startedAt, originRef, ringColorRef, forceUpdate]);

  return (
    <div ref={rootRef} className={buildClassName(styles.root, className)}>
      <div className={styles.slides} teactFastList>
        {keys.map((key) => (
          <div
            key={key}
            className={styles.slide}
            style={isWaving && key === activeKey ? HIDDEN_SLIDE_STYLE : undefined}
            data-wave-key={key}
          >
            {rendersRef.current[key]}
          </div>
        ))}
      </div>
      <div ref={ringRef} className={styles.ring} />
    </div>
  );
};

export default memo(QrThemeWave);
