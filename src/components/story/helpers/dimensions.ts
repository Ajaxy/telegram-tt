import type { IDimensions } from '../../../global/types';

const BASE_SCREEN_WIDTH = 1200;
const BASE_SCREEN_HEIGHT = 800;
const BASE_ACTIVE_SLIDE_WIDTH = 405;
const BASE_ACTIVE_SLIDE_HEIGHT = 720;
const BASE_SLIDE_WIDTH = 135;
const BASE_SLIDE_HEIGHT = 240;
const BASE_GAP_WIDTH = 40;

export function calculateSlideSizes(windowWidth: number, windowHeight: number): {
  activeSlide: IDimensions;
  slide: IDimensions;
  scale: number;
} {
  const scale = calculateScale(BASE_SCREEN_WIDTH, BASE_SCREEN_HEIGHT, windowWidth, windowHeight);

  // Avoid fractional values to prevent blurry text
  return {
    activeSlide: {
      width: roundToNearestEven(BASE_ACTIVE_SLIDE_WIDTH * scale),
      height: roundToNearestEven(BASE_ACTIVE_SLIDE_HEIGHT * scale),
    },
    slide: {
      width: roundToNearestEven(BASE_SLIDE_WIDTH * scale),
      height: roundToNearestEven(BASE_SLIDE_HEIGHT * scale),
    },
    scale,
  };
}

export function calculateOffsetX({
  scale,
  slideAmount,
  isActiveSlideSize,
  isMoveThroughActiveSlide,
  isBackward,
}: {
  scale: number;
  slideAmount: number;
  isActiveSlideSize: boolean;
  isMoveThroughActiveSlide?: boolean;
  isBackward: boolean;
}) {
  const mainOffset = BASE_GAP_WIDTH + (isActiveSlideSize ? BASE_ACTIVE_SLIDE_WIDTH : BASE_SLIDE_WIDTH);
  const additionalOffset = (Math.abs(slideAmount) - 1)
    * ((isMoveThroughActiveSlide ? BASE_ACTIVE_SLIDE_WIDTH : BASE_SLIDE_WIDTH) + BASE_GAP_WIDTH);
  const totalOffset = roundToNearestEven((mainOffset + additionalOffset) * scale);

  return isBackward ? -totalOffset : totalOffset;
}

function calculateScale(baseWidth: number, baseHeight: number, newWidth: number, newHeight: number) {
  const widthScale = newWidth / baseWidth;
  const heightScale = newHeight / baseHeight;

  return Math.min(widthScale, heightScale);
}

// Fractional values cause blurry text. Round to even to keep whole numbers while centering
function roundToNearestEven(value: number) {
  return Math.round(value / 2) * 2;
}
