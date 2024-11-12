import React, { memo } from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import { SNAP_EFFECT_CONTAINER_ID, SNAP_EFFECT_ID } from '../../../config';
import { selectCanAnimateSnapEffect } from '../../../global/selectors';
import generateUniqueId from '../../../util/generateUniqueId';
import { SVG_NAMESPACE } from '../../../util/svgController';

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

  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('class', styles.ghost);
  svg.setAttribute('width', `${width}px`);
  svg.setAttribute('height', `${height}px`);
  svg.setAttribute('style', `left: ${x}px; top: ${y}px;`);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const defs = document.createElementNS(SVG_NAMESPACE, 'defs');
  svg.appendChild(defs);

  const filter = createFilter(Math.min(width, height), seed);
  filter.setAttribute('id', filterId);
  defs.appendChild(filter);

  const g = document.createElementNS(SVG_NAMESPACE, 'g');
  g.setAttribute('filter', `url(#${filterId})`);
  svg.appendChild(g);

  const foreignObject = document.createElementNS(SVG_NAMESPACE, 'foreignObject');
  foreignObject.setAttribute('class', styles.elementContainer);
  foreignObject.setAttribute('width', `${width}px`);
  foreignObject.setAttribute('height', `${height}px`);
  g.appendChild(foreignObject);

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

function createFilter(smallestSide: number, baseSeed: number = 42) {
  const filter = document.createElementNS(SVG_NAMESPACE, 'filter');
  filter.setAttribute('x', '-150%');
  filter.setAttribute('y', '-150%');
  filter.setAttribute('width', '400%');
  filter.setAttribute('height', '400%');
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  const feTurbulence = document.createElementNS(SVG_NAMESPACE, 'feTurbulence');
  feTurbulence.setAttribute('type', 'fractalNoise');
  feTurbulence.setAttribute('baseFrequency', '0.5');
  feTurbulence.setAttribute('numOctaves', '1');
  feTurbulence.setAttribute('result', 'dustNoise');
  feTurbulence.setAttribute('seed', baseSeed.toString());
  filter.appendChild(feTurbulence);

  const feComponentTransfer = document.createElementNS(SVG_NAMESPACE, 'feComponentTransfer');
  feComponentTransfer.setAttribute('in', 'dustNoise');
  feComponentTransfer.setAttribute('result', 'dustNoiseMask');
  filter.appendChild(feComponentTransfer);

  const feFuncA = document.createElementNS(SVG_NAMESPACE, 'feFuncA');
  feFuncA.setAttribute('type', 'linear');
  feFuncA.setAttribute('slope', '5');
  feFuncA.setAttribute('intercept', '0');
  feComponentTransfer.appendChild(feFuncA);

  const feFuncAAnimate = document.createElementNS(SVG_NAMESPACE, 'animate');
  feFuncAAnimate.setAttribute('attributeName', 'slope');
  feFuncAAnimate.setAttribute('values', '5; 2; 1; 0');
  feFuncAAnimate.setAttribute('dur', `${DURATION}ms`);
  feFuncAAnimate.setAttribute('fill', 'freeze');
  feFuncA.appendChild(feFuncAAnimate);

  const feComposite = document.createElementNS(SVG_NAMESPACE, 'feComposite');
  feComposite.setAttribute('in', 'SourceGraphic');
  feComposite.setAttribute('in2', 'dustNoiseMask');
  feComposite.setAttribute('operator', 'in');
  feComposite.setAttribute('result', 'dustySource');
  filter.appendChild(feComposite);

  const feTurbulence2 = document.createElementNS(SVG_NAMESPACE, 'feTurbulence');
  feTurbulence2.setAttribute('type', 'fractalNoise');
  feTurbulence2.setAttribute('baseFrequency', '0.015');
  feTurbulence2.setAttribute('numOctaves', '1');
  feTurbulence2.setAttribute('result', 'displacementNoice1');
  feTurbulence2.setAttribute('seed', (baseSeed + 1).toString());
  filter.appendChild(feTurbulence2);

  const feTurbulence3 = document.createElementNS(SVG_NAMESPACE, 'feTurbulence');
  feTurbulence3.setAttribute('type', 'fractalNoise');
  feTurbulence3.setAttribute('baseFrequency', '1');
  feTurbulence3.setAttribute('numOctaves', '2');
  feTurbulence3.setAttribute('result', 'displacementNoice2');
  feTurbulence3.setAttribute('seed', (baseSeed + 2).toString());
  filter.appendChild(feTurbulence3);

  const feMerge = document.createElementNS(SVG_NAMESPACE, 'feMerge');
  feMerge.setAttribute('result', 'combinedNoise');
  filter.appendChild(feMerge);

  const feMergeNode1 = document.createElementNS(SVG_NAMESPACE, 'feMergeNode');
  feMergeNode1.setAttribute('in', 'displacementNoice1');
  feMerge.appendChild(feMergeNode1);

  const feMergeNode2 = document.createElementNS(SVG_NAMESPACE, 'feMergeNode');
  feMergeNode2.setAttribute('in', 'displacementNoice2');
  feMerge.appendChild(feMergeNode2);

  const feDisplacementMap = document.createElementNS(SVG_NAMESPACE, 'feDisplacementMap');
  feDisplacementMap.setAttribute('in', 'dustySource');
  feDisplacementMap.setAttribute('in2', 'combinedNoise');
  feDisplacementMap.setAttribute('scale', '0');

  feDisplacementMap.setAttribute('xChannelSelector', 'R');
  feDisplacementMap.setAttribute('yChannelSelector', 'G');
  filter.appendChild(feDisplacementMap);

  const feDisplacementMapAnimate = document.createElementNS(SVG_NAMESPACE, 'animate');
  feDisplacementMapAnimate.setAttribute('attributeName', 'scale');
  feDisplacementMapAnimate.setAttribute('values', `0; ${smallestSide * 3}`);
  feDisplacementMapAnimate.setAttribute('dur', `${DURATION}ms`);
  feDisplacementMapAnimate.setAttribute('fill', 'freeze');
  feDisplacementMap.appendChild(feDisplacementMapAnimate);

  return filter;
}
