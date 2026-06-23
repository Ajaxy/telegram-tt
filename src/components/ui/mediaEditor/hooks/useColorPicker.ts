import { useEffect, useRef, useState } from '@teact';
import Color from 'colorjs.io';

import {
  buildColorFromHex,
  buildHexFromColor,
  convertSrgbChannel,
} from '../../../../util/colors';
import getPointerPosition from '../../../../util/events/getPointerPosition';
import { clamp } from '../../../../util/math';

import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';

const PREDEFINED_COLORS_BASE = [
  '#FE4438', '#FF8901', '#FFD60A', '#33C759',
  '#62E5E0', '#0A84FF', '#5856D6', '#BD5CF3',
];
const RGB_CHANNEL_MAX = 255;
const HSV_HUE_MAX = 360;
const COLOR_PERCENT_MAX = 100;

interface PickerState {
  color: Color;
  hexInputValue: string;
  rgbInputValue: string;
}

type PickerInputState = Pick<PickerState, 'hexInputValue' | 'rgbInputValue'>;

interface UseColorPickerOptions {
  initialColor: string;
}

export function getPredefinedColors(theme: 'light' | 'dark') {
  return theme === 'light'
    ? ['#000000', ...PREDEFINED_COLORS_BASE]
    : ['#FFFFFF', ...PREDEFINED_COLORS_BASE];
}

export default function useColorPicker({ initialColor }: UseColorPickerOptions) {
  const hueSliderRef = useRef<HTMLDivElement>();
  const satBrightRef = useRef<HTMLDivElement>();

  const [isColorPickerOpen, openColorPicker, closeColorPicker] = useFlag(false);
  const [pickerState, setPickerState] = useState<PickerState>(() => buildPickerState(buildColorFromHex(initialColor)));

  const { color, hexInputValue, rgbInputValue } = pickerState;
  const selectedColor = buildHexFromColor(color).toUpperCase();
  const pickerColor = selectedColor;
  const [hueCoord, saturationCoord, brightnessCoord] = color.to('hsv').coords;
  const hue = (hueCoord || 0) / HSV_HUE_MAX;
  const saturation = saturationCoord! / COLOR_PERCENT_MAX;
  const brightness = brightnessCoord! / COLOR_PERCENT_MAX;
  const rgbColorValue = color.to('srgb').coords.map(convertSrgbChannel).join(', ');

  const updateColor = useLastCallback((newColor: Color, state?: Partial<PickerInputState>) => {
    setPickerState({
      ...buildPickerState(newColor),
      ...state,
    });
  });

  const setSelectedColor = useLastCallback((newColor: string) => {
    updateColor(buildColorFromHex(newColor));
  });

  useEffect(() => {
    if (!isColorPickerOpen) return;
    setPickerState((prev) => buildPickerState(prev.color));
  }, [isColorPickerOpen]);

  const updateFromHsv = useLastCallback((h: number, s: number, v: number) => {
    updateColor(new Color('hsv', [
      h * HSV_HUE_MAX,
      s * COLOR_PERCENT_MAX,
      v * COLOR_PERCENT_MAX,
    ]));
  });

  const setupColorDrag = useLastCallback((
    handler: (e: MouseEvent | TouchEvent) => void,
  ) => {
    const handleMove = (ev: MouseEvent) => handler(ev);
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  });

  const handleHueChange = useLastCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const el = hueSliderRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const { x: clientX } = getPointerPosition(e as React.MouseEvent);
    const x = clamp(clientX - rect.left, 0, rect.width);
    updateFromHsv(x / rect.width, saturation, brightness);
  });

  const handleSatBrightChange = useLastCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const el = satBrightRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const { x: clientX, y: clientY } = getPointerPosition(e as React.MouseEvent);
    const x = clamp(clientX - rect.left, 0, rect.width);
    const y = clamp(clientY - rect.top, 0, rect.height);
    updateFromHsv(hue, x / rect.width, 1 - y / rect.height);
  });

  const handleHexInput = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanHex = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 6);
    // Force the DOM input to show the cleaned value immediately
    e.target.value = `#${cleanHex}`;

    // Expand 3-char shortcode (#EEE -> #EEEEEE) or use 6-char hex
    const fullHex = cleanHex.length === 3
      ? cleanHex.split('').map((char) => char + char).join('')
      : cleanHex;

    if (fullHex.length === 6) {
      updateColor(buildColorFromHex(fullHex), { hexInputValue: `#${cleanHex}` });
    } else {
      setPickerState((prev) => ({ ...prev, hexInputValue: `#${cleanHex}` }));
    }
  });

  const handleRgbInput = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    const parts = value.split(',').map((part) => part.trim());
    if (parts.length === 3) {
      const r = parseInt(parts[0], 10);
      const g = parseInt(parts[1], 10);
      const b = parseInt(parts[2], 10);

      if (![r, g, b].some((channel) => Number.isNaN(channel) || channel < 0 || channel > RGB_CHANNEL_MAX)) {
        updateColor(new Color('srgb', [
          r / RGB_CHANNEL_MAX,
          g / RGB_CHANNEL_MAX,
          b / RGB_CHANNEL_MAX,
        ]), { rgbInputValue: value });
        return;
      }
    }

    setPickerState((prev) => ({ ...prev, rgbInputValue: value }));
  });

  const handleHexInputBlur = useLastCallback(() => {
    setPickerState((prev) => ({ ...prev, hexInputValue: selectedColor }));
  });

  const handleRgbInputBlur = useLastCallback(() => {
    setPickerState((prev) => ({ ...prev, rgbInputValue: rgbColorValue }));
  });

  const handleColorSelect = useLastCallback((newColor: string) => {
    updateColor(buildColorFromHex(newColor));
    closeColorPicker();
  });

  const handleHueSliderMouseDown = useLastCallback((e: React.MouseEvent) => {
    handleHueChange(e);
    setupColorDrag(handleHueChange);
  });

  const handleSatBrightMouseDown = useLastCallback((e: React.MouseEvent) => {
    handleSatBrightChange(e);
    setupColorDrag(handleSatBrightChange);
  });

  return {
    hueSliderRef,
    satBrightRef,
    selectedColor,
    setSelectedColor,
    isColorPickerOpen,
    openColorPicker,
    closeColorPicker,
    hue,
    saturation,
    brightness,
    pickerColor,
    hexInputValue,
    rgbInputValue,
    handleHueChange,
    handleSatBrightChange,
    handleHexInput,
    handleHexInputBlur,
    handleRgbInput,
    handleRgbInputBlur,
    handleColorSelect,
    handleHueSliderMouseDown,
    handleSatBrightMouseDown,
  };
}

function buildPickerState(color: Color): PickerState {
  return {
    color,
    hexInputValue: buildHexFromColor(color).toUpperCase(),
    rgbInputValue: color.to('srgb').coords.map(convertSrgbChannel).join(', '),
  };
}
