import { useEffect } from '../../lib/teact/teact';

import { addSvgDefinition, removeSvgDefinition, SVG_NAMESPACE } from '../../util/svgController';
import { hexToRgb } from '../../util/switchTheme';

const SVG_MAP = new Map<string, SvgColorFilter>();

class SvgColorFilter {
  public filterId: string;

  private referenceCount = 0;

  constructor(public color: string) {
    this.filterId = `color-filter-${color.slice(1)}`;

    const filter = document.createElementNS(SVG_NAMESPACE, 'filter');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    addSvgDefinition(filter, this.filterId);

    const feColorMatrix = document.createElementNS(SVG_NAMESPACE, 'feColorMatrix');
    feColorMatrix.setAttribute('type', 'matrix');

    const rgbColor = hexToRgb(color);
    feColorMatrix.setAttribute(
      'values',
      `0 0 0 0 ${rgbColor.r / 255} 0 0 0 0 ${rgbColor.g / 255} 0 0 0 0 ${rgbColor.b / 255} 0 0 0 1 0`,
    );

    filter.appendChild(feColorMatrix);
  }

  public getFilterId() {
    this.referenceCount += 1;
    return this.filterId;
  }

  public removeReference() {
    this.referenceCount -= 1;
    if (this.referenceCount === 0) {
      removeSvgDefinition(this.filterId);
    }
  }

  public isUsed() {
    return this.referenceCount > 0;
  }
}

export default function useColorFilter(color?: string, asValue?: boolean) {
  useEffect(() => {
    if (!color) return undefined;

    return () => {
      const colorFilter = SVG_MAP.get(color);
      if (colorFilter) {
        colorFilter.removeReference();
        if (!colorFilter.isUsed()) {
          SVG_MAP.delete(colorFilter.color);
        }
      }
    };
  }, [color]);

  if (!color) return undefined;

  if (SVG_MAP.has(color)) {
    const svg = SVG_MAP.get(color)!;
    return prepareStyle(svg.getFilterId(), asValue);
  }

  const svg = new SvgColorFilter(color);
  SVG_MAP.set(color, svg);

  return prepareStyle(svg.getFilterId(), asValue);
}

function prepareStyle(filterId: string, asValue?: boolean) {
  if (asValue) {
    return `url(#${filterId})`;
  }

  return `filter: url(#${filterId});`;
}
