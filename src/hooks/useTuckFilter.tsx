import { useEffect } from '../lib/teact/teact';

import { SVG_NAMESPACE } from '../config';
import {
  IS_SVG_CALC_SUPPORTED, IS_TUCK_SUPPORTED,
} from '../util/browser/windowEnvironment';
import { addSvgDefinition, removeSvgDefinition } from '../util/svgController';

import pickerTuck from '../assets/filters/status-picker-tuck.avif';

const FILTER_BAND_START = IS_SVG_CALC_SUPPORTED ? 'calc(100% - 64px)' : '80%';
const FILTER_BAND_HEIGHT = IS_SVG_CALC_SUPPORTED ? '32' : '10%';

export default function useTuckFilter(filterId: string) {
  useEffect(() => {
    if (!IS_TUCK_SUPPORTED) return undefined;

    addSvgDefinition(
      <filter
        x="0"
        y="0"
        width="100%"
        height="100%"
        filterUnits="objectBoundingBox"
        primitiveUnits="userSpaceOnUse"
        color-interpolation-filters="sRGB"
        xmlns={SVG_NAMESPACE}
      >
        <feOffset
          in="SourceGraphic"
          dx="0"
          dy="0"
          width="100%"
          height={FILTER_BAND_START}
          result="untuckedSource"
        />
        <feImage
          href={pickerTuck}
          x="0"
          y={FILTER_BAND_START}
          width="100%"
          height={FILTER_BAND_HEIGHT}
          preserveAspectRatio="none"
          result="tuckMap"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="tuckMap"
          x="0"
          y={FILTER_BAND_START}
          width="100%"
          height={FILTER_BAND_HEIGHT}
          scale="48"
          xChannelSelector="R"
          yChannelSelector="B"
          result="tuckedSource"
        />
        <feMerge>
          <feMergeNode in="untuckedSource" />
          <feMergeNode in="tuckedSource" />
        </feMerge>
      </filter>,
      filterId,
    );

    return () => {
      removeSvgDefinition(filterId);
    };
  }, [filterId]);

  return IS_TUCK_SUPPORTED ? `filter: url(#${filterId})` : undefined;
}
