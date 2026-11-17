import { useEffect, useMemo } from '../../lib/teact/teact';

import { SVG_NAMESPACE } from '../../config';
import { buildColor, convertColor } from '../../lib/color';
import { addSvgDefinition, removeSvgDefinition } from '../../util/svgController';
import useWindow from '../useWindow';

const SVG_MAP = new WeakMap<Document, Map<string, SvgColorFilter>>();

class SvgColorFilter {
  public filterId: string;

  private referenceCount = 0;

  constructor(public color: string, private targetDocument: Document) {
    const [r, g, b] = convertColor(buildColor(color), 'srgb').coords;
    // Distinct references make adopted elements resolve the filter in their owning document
    this.filterId = addSvgDefinition(
      <filter color-interpolation-filters="sRGB" xmlns={SVG_NAMESPACE}>
        <feColorMatrix
          type="matrix"
          values={`0 0 0 0 ${r || 0} 0 0 0 0 ${g || 0} 0 0 0 0 ${b || 0} 0 0 0 1 0`}
        />
      </filter>,
      undefined,
      targetDocument,
    );
  }

  public getFilterId() {
    this.referenceCount += 1;
    return this.filterId;
  }

  public removeReference() {
    this.referenceCount -= 1;
    if (this.referenceCount === 0) {
      removeSvgDefinition(this.filterId, this.targetDocument);
    }
  }

  public isUsed() {
    return this.referenceCount > 0;
  }
}

export default function useColorFilter(color?: string, asValue?: boolean) {
  const targetDocument = useWindow().document;

  const filterId = useMemo(() => {
    if (!color) return undefined;

    const filters = SVG_MAP.get(targetDocument) || new Map<string, SvgColorFilter>();
    SVG_MAP.set(targetDocument, filters);
    const svg = filters.get(color) || new SvgColorFilter(color, targetDocument);
    filters.set(color, svg);
    return svg.getFilterId();
  }, [color, targetDocument]);

  useEffect(() => {
    if (!color) return undefined;

    return () => {
      const filters = SVG_MAP.get(targetDocument)!;
      const colorFilter = filters.get(color);
      if (colorFilter) {
        colorFilter.removeReference();
        if (!colorFilter.isUsed()) {
          filters.delete(colorFilter.color);
        }
      }
    };
  }, [color, targetDocument]);

  return filterId ? prepareStyle(filterId, asValue) : undefined;
}

function prepareStyle(filterId: string, asValue?: boolean) {
  if (asValue) {
    return `url(#${filterId})`;
  }

  return `filter: url(#${filterId});`;
}
