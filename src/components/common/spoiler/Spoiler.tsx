import type { TeactNode } from '../../../lib/teact/teact';
import { memo, useEffect, useRef, useState } from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import { ApiMessageEntityTypes } from '../../../api/types';
import { SPOILER_MORPH } from '../../../lib/gpuCanvas/types';

import { requestMeasure } from '../../../lib/fasterdom/fasterdom';
import { getGpuCanvas } from '../../../lib/gpuCanvas/gpuCanvas';
import { selectCanAnimateInterface } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import stopEvent from '../../../util/stopEvent';
import { drawSpoilerGlyphs, findGpuSharedCanvas, measureSpoilers } from './measureSpoilers';

import { useSharedCanvas } from '../../../hooks/useCoordsInSharedCanvas';
import useLastCallback from '../../../hooks/useLastCallback';

import styles from './Spoiler.module.scss';

type OwnProps = {
  children?: TeactNode;
  containerId?: string;
};

// Client coordinates of the click and the radius the reveal grows to
type RevealOrigin = {
  x: number;
  y: number;
  radius: number;
};

type FoundGpuCanvas = NonNullable<ReturnType<typeof findGpuCanvas>>;

type SpoilerEntry = {
  contentRef: { current?: HTMLElement };
  reveal: (origin?: RevealOrigin) => void;
};

const spoilersByContainerId = new Map<string, SpoilerEntry[]>();

const Spoiler = ({
  children,
  containerId,
}: OwnProps) => {
  const withGpuCanvas = useSharedCanvas()?.isGpu;
  const contentRef = useRef<HTMLDivElement>();

  const [isRevealed, setIsRevealed] = useState(false);
  const [morphStyle, setMorphStyle] = useState<string>();
  const morphedCanvasesRef = useRef<FoundGpuCanvas[]>();

  const reveal = useLastCallback((origin?: RevealOrigin) => {
    if (isRevealed) return;

    setMorphStyle(origin ? buildMorphStyle(contentRef.current!, origin) : undefined);
    setIsRevealed(true);
  });

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    stopEvent(e);

    const { clientX: x, clientY: y } = e;
    // Without animations the content appears at once, and the measurement after the render drops the particles
    const canAnimate = selectCanAnimateInterface(getGlobal());
    const entries = spoilersByContainerId.get(containerId!) || [];
    const radiusByCanvas = new Map<HTMLCanvasElement, number | undefined>();
    const morphedCanvases: FoundGpuCanvas[] = [];
    const canvases = entries.map(({ contentRef: entryContentRef }) => {
      const found = withGpuCanvas && entryContentRef.current ? findGpuCanvas(entryContentRef.current) : undefined;
      if (found && !radiusByCanvas.has(found.canvas)) {
        radiusByCanvas.set(found.canvas, canAnimate ? startGpuMorph(found, x, y) : undefined);
        morphedCanvases.push(found);
      }

      return found?.canvas;
    });

    morphedCanvasesRef.current = morphedCanvases;
    entries.forEach(({ reveal: revealEntry }, i) => {
      const radius = canvases[i] && radiusByCanvas.get(canvases[i]);
      revealEntry(radius !== undefined ? { x, y, radius } : undefined);
    });
  });

  // A measurement queued before the toggle saw the previous state, so the latest one follows the rendered state
  useEffect(() => {
    const morphedCanvases = morphedCanvasesRef.current;
    if (!morphedCanvases) return;

    morphedCanvasesRef.current = undefined;
    requestMeasure(() => {
      morphedCanvases.forEach(({ canvas, parent, gpuCanvas }) => {
        gpuCanvas.setSpoilers(measureSpoilers(canvas, parent, `.${styles.concealed}`));
      });
    });
  }, [isRevealed]);

  const handleAnimationEnd = useLastCallback((e: React.AnimationEvent<HTMLSpanElement>) => {
    if (e.target === e.currentTarget) setMorphStyle(undefined);
  });

  useEffect(() => {
    if (!containerId) {
      return undefined;
    }

    const entry = { contentRef, reveal };
    spoilersByContainerId.set(containerId, [...(spoilersByContainerId.get(containerId) || []), entry]);

    // Other spoilers of the container stay registered, such as after an edit removes one of them
    return () => {
      const entries = spoilersByContainerId.get(containerId)?.filter((item) => item !== entry);
      if (entries?.length) {
        spoilersByContainerId.set(containerId, entries);
        return;
      }

      spoilersByContainerId.delete(containerId);
    };
  }, [containerId]);

  return (
    <span
      className={buildClassName(
        !isRevealed && styles.concealed,
        !isRevealed && Boolean(containerId) && styles.animated,
        withGpuCanvas && styles.gpu,
        morphStyle && styles.revealing,
      )}
      onClick={containerId && !isRevealed ? handleClick : undefined}
      data-entity-type={ApiMessageEntityTypes.Spoiler}
    >
      <span
        className={styles.content}
        ref={contentRef}
        style={morphStyle}
        onAnimationEnd={morphStyle ? handleAnimationEnd : undefined}
      >
        {children}
      </span>
    </span>
  );
};

export default memo(Spoiler);

// Starts flying the particles on the GPU canvas of the container to the glyphs, and returns the farthest distance
// from the click within the canvas
function startGpuMorph({ canvas, parent, gpuCanvas }: FoundGpuCanvas, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  gpuCanvas.reveal(x, y, drawSpoilerGlyphs(canvas, parent, `.${styles.concealed}`));

  return Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y));
}

function findGpuCanvas(spoiler: HTMLElement) {
  const canvas = findGpuSharedCanvas(spoiler);
  const gpuCanvas = canvas && getGpuCanvas(canvas);

  return gpuCanvas ? { canvas, parent: canvas.parentElement!, gpuCanvas } : undefined;
}

// The text appears behind a soft front, which follows the particles arriving to their glyphs. An inline mask is
// painted over its line fragments laid out in one row, so every fragment gets its own circle layer.
function buildMorphStyle(content: HTMLElement, { x, y, radius }: RevealOrigin) {
  const edge = (SPOILER_MORPH.fade / SPOILER_MORPH.spread) * radius;
  const images: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];
  let offset = 0;

  Array.from(content.getClientRects()).forEach((rect) => {
    images.push(
      `radial-gradient(circle at ${x - rect.left}px ${y - rect.top}px, `
      + `#000 calc(var(--spoiler-morph-radius) - ${edge}px), transparent var(--spoiler-morph-radius))`,
    );
    sizes.push(`${rect.width}px ${rect.height}px`);
    positions.push(`${offset}px 0`);
    offset += rect.width;
  });

  return [
    `--spoiler-morph-max-radius: ${radius + edge}px`,
    `--spoiler-morph-delay: ${SPOILER_MORPH.fly + SPOILER_MORPH.jitter / 2}ms`,
    `--spoiler-morph-duration: ${SPOILER_MORPH.spread + SPOILER_MORPH.fade}ms`,
    `mask-image: ${images.join(', ')}`,
    `mask-size: ${sizes.join(', ')}`,
    `mask-position: ${positions.join(', ')}`,
  ].join('; ');
}
