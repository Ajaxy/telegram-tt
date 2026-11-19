// The islands as a stylesheet, measured from the rendered ones and saved as a CSS snapshot, so a page load paints
// them on the static elements in `index.html` before any script runs. `UiLoader` then covers them with its skeleton.
// The island widths follow the viewport, so the snapshot applies only at the window width it was measured at.
import type { ThemeKey } from '../types';

import { SKELETON_SNAPSHOT_PATH } from '../config';
import { requestMeasure } from '../lib/fasterdom/fasterdom';
import { saveCssSnapshot } from './cssSnapshot';

// Above the wallpaper snapshot layers on `body`
const ISLAND_Z_INDEX = 2;
const HOST_SELECTOR = 'html.initial';
// Set by `initialChat.js` when the URL opens a chat
const WITH_CHAT_HOST_SELECTOR = `${HOST_SELECTOR}.with-initial-chat`;
// The window width is rounded, while media queries compare its exact value
const WIDTH_TOLERANCE = 0.5;

export function saveSkeletonSnapshot(systemTheme?: ThemeKey) {
  requestMeasure(() => {
    const css = buildSkeletonCss(systemTheme);
    if (!css) return;

    // The rules are short enough to be their own key
    void saveCssSnapshot(SKELETON_SNAPSHOT_PATH, css, () => css).catch(() => undefined);
  });
}

function buildSkeletonCss(systemTheme?: ThemeKey) {
  const { innerWidth: width, innerHeight: height } = window;
  const leftColumn = document.getElementById('LeftColumn');
  const leftColumnRect = leftColumn?.getBoundingClientRect();
  // Narrow layouts slide the left column out of view
  if (!leftColumnRect || !getIsInView(leftColumnRect, width)) return undefined;

  const rules = [buildIslandRule(
    `${HOST_SELECTOR} .initial-left-column`, leftColumnRect, height, buildSurfaceStyles(leftColumn!),
  )];

  const foldersSidebar = document.getElementById('FoldersSidebar');
  const foldersSidebarRect = foldersSidebar?.getBoundingClientRect();
  if (foldersSidebarRect && getIsInView(foldersSidebarRect, width)) {
    const foldersSidebarStyle = getComputedStyle(foldersSidebar!);
    // The sidebar tints and blurs the wallpaper with its pseudo-elements
    rules.push(buildIslandRule(`${HOST_SELECTOR} .initial-folders-sidebar`, foldersSidebarRect, height, {
      'background-color': getComputedStyle(foldersSidebar!, '::before').backgroundColor,
      'backdrop-filter': getComputedStyle(foldersSidebar!, '::after').backdropFilter,
      'border-radius': foldersSidebarStyle.borderRadius,
      'corner-shape': foldersSidebarStyle.getPropertyValue('corner-shape'),
    }));
  }

  const rightColumn = document.getElementById('RightColumn');
  const rightColumnRect = rightColumn?.getBoundingClientRect();
  // The closed right column slides out of view
  if (rightColumnRect && getIsInView(rightColumnRect, width)) {
    rules.push(buildIslandRule(
      `${WITH_CHAT_HOST_SELECTOR} .initial-right-column`, rightColumnRect, height, buildSurfaceStyles(rightColumn!),
    ));
  }

  const conditions = [
    `(min-width: ${width - WIDTH_TOLERANCE}px)`,
    `(max-width: ${width + WIDTH_TOLERANCE}px)`,
    systemTheme && `(prefers-color-scheme: ${systemTheme})`,
  ].filter(Boolean);

  return `@media ${conditions.join(' and ')} { ${rules.join(' ')} }`;
}

function getIsInView(rect: DOMRect, viewportWidth: number) {
  return rect.left >= 0 && rect.right <= viewportWidth;
}

function buildSurfaceStyles(element: HTMLElement) {
  const style = getComputedStyle(element);

  return {
    'background-color': style.backgroundColor,
    'box-shadow': style.boxShadow,
    'border-radius': style.borderRadius,
    'corner-shape': style.getPropertyValue('corner-shape'),
  };
}

function buildIslandRule(selector: string, rect: DOMRect, viewportHeight: number, styles: Record<string, string>) {
  const declarations = [
    'position: fixed',
    `z-index: ${ISLAND_Z_INDEX}`,
    `top: ${rect.top}px`,
    `bottom: ${viewportHeight - rect.bottom}px`,
    `left: ${rect.left}px`,
    `width: ${rect.width}px`,
    ...Object.entries(styles)
      .filter(([, value]) => value && value !== 'none')
      .map(([property, value]) => `${property}: ${value}`),
  ];

  return `${selector} { ${declarations.join('; ')}; }`;
}
