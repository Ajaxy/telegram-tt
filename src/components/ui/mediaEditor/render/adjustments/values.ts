import type { AdjustmentKey, MediaEditDocument } from '../../../../../types/mediaEditor';

import { isCurvesDefault } from './curves';

export type AdjustmentTool = {
  key: AdjustmentKey;
  labelKey: 'Enhance' | 'Exposure' | 'Contrast' | 'Saturation' | 'Warmth' | 'Fade' | 'Highlights' | 'Shadows'
    | 'Vignette' | 'Grain' | 'Sharpen';
  min: number;
  isPhotoOnly?: true;
};

type AdjustmentUniforms = {
  sharpen: number;
  shadows: number;
  highlights: number;
  contrast: number;
  fade: number;
  saturation: number;
  exposure: number;
  warmth: number;
  grain: number;
  vignette: number;
  shadowsTintColor: [number, number, number];
  shadowsTintIntensity: number;
  highlightsTintColor: [number, number, number];
  highlightsTintIntensity: number;
};

export const ADJUSTMENT_TOOLS: AdjustmentTool[] = [
  { key: 'enhance', labelKey: 'Enhance', min: 0 },
  { key: 'exposure', labelKey: 'Exposure', min: -100 },
  { key: 'contrast', labelKey: 'Contrast', min: -100 },
  { key: 'saturation', labelKey: 'Saturation', min: -100 },
  { key: 'warmth', labelKey: 'Warmth', min: -100 },
  { key: 'fade', labelKey: 'Fade', min: 0 },
  { key: 'highlights', labelKey: 'Highlights', min: -100 },
  { key: 'shadows', labelKey: 'Shadows', min: -100 },
  { key: 'vignette', labelKey: 'Vignette', min: 0 },
  { key: 'grain', labelKey: 'Grain', min: 0, isPhotoOnly: true },
  { key: 'sharpen', labelKey: 'Sharpen', min: 0, isPhotoOnly: true },
];

export const TINT_SHADOWS_COLORS = ['#FF4D4D', '#F48022', '#FFCD00', '#81D281', '#71C5D6', '#0072BC', '#662D91'];
export const TINT_HIGHLIGHTS_COLORS = ['#EF9286', '#EACEA2', '#F2E17C', '#A4EDAE', '#89DCE5', '#2E8BC8', '#CD98E5'];

const NO_TINT_COLOR: [number, number, number] = [0, 0, 0];
const TINT_INTENSITY = 0.5;
const SATURATION_BOOST = 1.05;
const ENHANCE_SHARPEN = 0.15;
const SHARPEN_SCALE = 0.45;
const ENHANCE_SATURATION = 0.2;
const ENHANCE_HIGHLIGHTS = 0.15;
const ENHANCE_SHADOWS = -0.075;
const ENHANCE_CONTRAST = 0.1;
const ENHANCE_EXPOSURE = 0.25;
const CONTRAST_SCALE = 0.3;
const HIGHLIGHTS_SCALE = 0.75;
const SHADOWS_SCALE = 0.55;
const GRAIN_SCALE = 0.04;

export function hasColorAdjustments({ adjustments, tint, curves }: MediaEditDocument) {
  return Boolean(
    (adjustments && Object.values(adjustments).some(Boolean))
    || tint?.shadowsColor || tint?.highlightsColor
    || (curves && !isCurvesDefault(curves)),
  );
}

export function getAdjustmentUniforms({ adjustments = {}, tint }: MediaEditDocument): AdjustmentUniforms {
  const value = (key: AdjustmentKey) => (adjustments[key] ?? 0) / 100;
  const enhance = value('enhance');
  const saturation = value('saturation') + enhance * ENHANCE_SATURATION;

  return {
    sharpen: value('sharpen') * SHARPEN_SCALE + enhance * ENHANCE_SHARPEN,
    shadows: (value('shadows') + enhance * ENHANCE_SHADOWS) * SHADOWS_SCALE + 1,
    highlights: (value('highlights') + enhance * ENHANCE_HIGHLIGHTS) * HIGHLIGHTS_SCALE + 1,
    contrast: (value('contrast') + enhance * ENHANCE_CONTRAST) * CONTRAST_SCALE + 1,
    fade: value('fade'),
    saturation: (saturation > 0 ? saturation * SATURATION_BOOST : saturation) + 1,
    exposure: value('exposure') + enhance * ENHANCE_EXPOSURE,
    warmth: value('warmth'),
    grain: value('grain') * GRAIN_SCALE,
    vignette: value('vignette'),
    shadowsTintColor: tint?.shadowsColor ? hexToRgb(tint.shadowsColor) : NO_TINT_COLOR,
    shadowsTintIntensity: tint?.shadowsColor ? TINT_INTENSITY : 0,
    highlightsTintColor: tint?.highlightsColor ? hexToRgb(tint.highlightsColor) : NO_TINT_COLOR,
    highlightsTintIntensity: tint?.highlightsColor ? TINT_INTENSITY : 0,
  };
}

export function hexToRgb(hex: string): [number, number, number] {
  const getChannel = (index: number) => parseInt(hex.slice(index, index + 2), 16) / 255;
  return [getChannel(1), getChannel(3), getChannel(5)];
}
