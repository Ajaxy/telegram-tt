import React, { useEffect } from '../../../../lib/teact/teact';

import { SVG_NAMESPACE } from '../../../../config';
import { addSvgDefinition, removeSvgDefinition } from '../../../../util/svgController';

const SVG_MAP = new Map<string, SvgFluidBackgroundFilter>();

class SvgFluidBackgroundFilter {
  public filterId: string;

  private referenceCount = 0;

  constructor(public color: string) {
    this.filterId = `fluid-background-filter-${color.slice(1)}`;

    addSvgDefinition((
      <filter color-interpolation-filters="sRGB" xmlns={SVG_NAMESPACE}>
        <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" />
        <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -15" result="goo" />
        <feComposite in="SourceAlpha" in2="goo" operator="over" result="outline" />
        <feFlood flood-color={color} result="color" />
        <feComposite in="color" in2="outline" operator="in" />
      </filter>
    ), this.filterId);
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

export default function useFluidBackgroundFilter(color?: string, asValue?: boolean) {
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

  const svg = new SvgFluidBackgroundFilter(color);
  SVG_MAP.set(color, svg);

  return prepareStyle(svg.getFilterId(), asValue);
}

function prepareStyle(filterId: string, asValue?: boolean) {
  if (asValue) {
    return `url(#${filterId})`;
  }

  return `filter: url(#${filterId});`;
}
