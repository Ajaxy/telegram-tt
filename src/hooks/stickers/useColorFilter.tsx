import Color from 'colorjs.io';
import { useEffect } from '../../lib/teact/teact';

import { SVG_NAMESPACE } from '../../config';
import { addSvgDefinition, removeSvgDefinition } from '../../util/svgController';

const SVG_MAP = new Map<string, SvgColorFilter>();

class SvgColorFilter {
  public filterId: string;

  private referenceCount = 0;

  constructor(public color: string) {
    this.filterId = `color-filter-${color.slice(1)}`;

    const [r, g, b] = new Color(color).to('srgb').coords;
    addSvgDefinition(
      <filter color-interpolation-filters="sRGB" xmlns={SVG_NAMESPACE}>
        <feColorMatrix
          type="matrix"
          values={`0 0 0 0 ${r || 0} 0 0 0 0 ${g || 0} 0 0 0 0 ${b || 0} 0 0 0 1 0`}
        />
      </filter>,
      this.filterId,
    );
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
