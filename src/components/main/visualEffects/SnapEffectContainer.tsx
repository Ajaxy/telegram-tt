import React, { memo } from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import { SNAP_EFFECT_CONTAINER_ID, SNAP_EFFECT_ID, SVG_NAMESPACE } from '../../../config';
import { selectCanAnimateSnapEffect } from '../../../global/selectors';
import jsxToHtml from '../../../util/element/jsxToHtml';
import generateUniqueId from '../../../util/generateUniqueId';

import styles from './SnapEffectContainer.module.scss';

const VISIBLITY_MARGIN = 50;
const DURATION = 1000;

const SnapEffectContainer = () => {
  return (
    <div className={styles.root} id={SNAP_EFFECT_CONTAINER_ID} />
  );
};

export default memo(SnapEffectContainer);

export function animateSnap(element: HTMLElement) {
  const global = getGlobal();
  const canPlayEffect = selectCanAnimateSnapEffect(global);
  if (!canPlayEffect) return false;
  // Get element current fixed position on screen
  const rect = element.getBoundingClientRect();
  const x = rect.left + window.scrollX;
  const y = rect.top + window.scrollY;
  const width = rect.width;
  const height = rect.height;

  // Check for visibility
  if (x + width + VISIBLITY_MARGIN < 0 || x - VISIBLITY_MARGIN > window.innerWidth
    || y + height + VISIBLITY_MARGIN < 0 || y - VISIBLITY_MARGIN > window.innerHeight) {
    return false;
  }

  const seed = Math.floor(Date.now() / 1000);
  const filterId = `${SNAP_EFFECT_ID}-${generateUniqueId()}`;

  const component = (
    <svg
      className={styles.ghost}
      width={width}
      height={height}
      style={`left: ${x}px; top: ${y}px;`}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        {createFilter(filterId, Math.min(width, height), seed)}
      </defs>
      <g filter={`url(#${filterId})`}>
        <foreignObject className={styles.elementContainer} width={width} height={height} />
      </g>
    </svg>
  );

  const svg = jsxToHtml(component)[0] as HTMLElement;
  const foreignObject = svg.querySelector('foreignObject')!;

  const computedStyle = window.getComputedStyle(element);
  const clone = element.cloneNode(true) as HTMLElement;
  Array.from(computedStyle).forEach((key) => (
    clone.style.setProperty(key, computedStyle.getPropertyValue(key), 'important')
  ));

  foreignObject.appendChild(clone);

  const snapContainer = document.getElementById(SNAP_EFFECT_CONTAINER_ID)!;
  snapContainer.appendChild(svg);

  svg.addEventListener('animationend', () => {
    snapContainer.removeChild(svg);
  }, {
    once: true,
  });

  return true;
}

function createFilter(id: string, smallestSide: number, baseSeed: number = 42) {
  return (
    <filter
      xmlns={SVG_NAMESPACE}
      id={id}
      x="-150%"
      y="-150%"
      width="400%"
      height="400%"
      color-interpolation-filters="sRGB"
    >
      <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="1" result="dustNoise" seed={baseSeed} />
      <feComponentTransfer in="dustNoise" result="dustNoiseMask">
        <feFuncA type="linear" slope="5" intercept="0">
          <animate attributeName="slope" values="5; 2; 1; 0" dur={`${DURATION}ms`} fill="freeze" />
        </feFuncA>
      </feComponentTransfer>
      <feComposite in="SourceGraphic" in2="dustNoiseMask" operator="in" result="dustySource" />
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.015"
        numOctaves="1"
        result="displacementNoise1"
        seed={baseSeed + 1}
      />
      <feTurbulence
        type="fractalNoise"
        baseFrequency="1"
        numOctaves="2"
        result="displacementNoise2"
        seed={baseSeed + 2}
      />
      <feMerge result="combinedNoise">
        <feMergeNode in="displacementNoise1" />
        <feMergeNode in="displacementNoise2" />
      </feMerge>
      <feDisplacementMap in="dustySource" in2="combinedNoise" scale="0" xChannelSelector="R" yChannelSelector="G">
        <animate attributeName="scale" values={`0; ${smallestSide * 3}`} dur={`${DURATION}ms`} fill="freeze" />
      </feDisplacementMap>
    </filter>
  );
}
