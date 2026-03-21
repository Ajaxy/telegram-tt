import { useEffect, useRef, useState } from '@teact';

import { hex2rgb, hsv2rgb, rgb2hex, rgb2hsv } from '../../../../util/colors';
import getPointerPosition from '../../../../util/events/getPointerPosition';
import { clamp } from '../../../../util/math';

import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';

const PREDEFINED_COLORS_BASE = [
  '#FE4438', '#FF8901', '#FFD60A', '#33C759',
  '#62E5E0', '#0A84FF', '#5856D6', '#BD5CF3',
];

export function getPredefinedColors(theme: 'light' | 'dark') {
  return theme === 'light'
    ? ['#000000', ...PREDEFINED_COLORS_BASE]
    : ['#FFFFFF', ...PREDEFINED_COLORS_BASE];
}

interface PickerState {
  hue: number;
  saturation: number;
  brightness: number;
  hexInputValue: string;
  rgbInputValue: string;
}

function buildPickerState(h: number, s: number, v: number): PickerState {
  const rgb = hsv2rgb([h, s, v]);
  const hex = rgb2hex(rgb);
  return {
    hue: h,
    saturation: s,
    brightness: v,
    hexInputValue: hex.toUpperCase(),
    rgbInputValue: `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`,
  };
}

const DEFAULT_PICKER_STATE: PickerState = {
  hue: 0,
  saturation: 1,
  brightness: 1,
  hexInputValue: '',
  rgbInputValue: '',
};

interface UseColorPickerOptions {
  initialColor: string;
}

export default function useColorPicker({ initialColor }: UseColorPickerOptions) {
  const hueSliderRef = useRef<HTMLDivElement>();
  const satBrightRef = useRef<HTMLDivElement>();

  const [selectedColor, setSelectedColor] = useState(initialColor);
  const [isColorPickerOpen, openColorPicker, closeColorPicker] = useFlag(false);
  const [pickerState, setPickerState] = useState<PickerState>(DEFAULT_PICKER_STATE);

  const pickerColor = rgb2hex(hsv2rgb([pickerState.hue, pickerState.saturation, pickerState.brightness]));

  useEffect(() => {
    if (!isColorPickerOpen) return;
    const rgb = hex2rgb(selectedColor.replace('#', ''));
    const [h, s, v] = rgb2hsv(rgb);
    setPickerState(buildPickerState(h, s, v));
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [isColorPickerOpen]);

  const updateFromHsv = useLastCallback((h: number, s: number, v: number) => {
    const state = buildPickerState(h, s, v);
    setPickerState(state);
    setSelectedColor(rgb2hex(hsv2rgb([h, s, v])));
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
    updateFromHsv(x / rect.width, pickerState.saturation, pickerState.brightness);
  });

  const handleSatBrightChange = useLastCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const el = satBrightRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const { x: clientX, y: clientY } = getPointerPosition(e as React.MouseEvent);
    const x = clamp(clientX - rect.left, 0, rect.width);
    const y = clamp(clientY - rect.top, 0, rect.height);
    updateFromHsv(pickerState.hue, x / rect.width, 1 - y / rect.height);
  });

  const handleHexInput = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanHex = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 6);
    // Force the DOM input to show the cleaned value immediately
    e.target.value = `#${cleanHex}`;

    // Expand 3-char shortcode (#EEE -> #EEEEEE) or use 6-char hex
    const fullHex = cleanHex.length === 3
      ? cleanHex.split('').map((c) => c + c).join('')
      : cleanHex;

    if (fullHex.length === 6) {
      const [h, s, v] = rgb2hsv(hex2rgb(fullHex));
      const state = buildPickerState(h, s, v);
      // Preserve the raw typed hex while updating HSV + rgb
      setPickerState({ ...state, hexInputValue: `#${cleanHex}` });
      setSelectedColor(rgb2hex(hsv2rgb([h, s, v])));
    } else {
      setPickerState((prev) => ({ ...prev, hexInputValue: `#${cleanHex}` }));
    }
  });

  const handleRgbInput = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    const parts = value.split(',').map((p) => p.trim());
    if (parts.length === 3) {
      const r = parseInt(parts[0], 10);
      const g = parseInt(parts[1], 10);
      const b = parseInt(parts[2], 10);

      if (![r, g, b].some((v) => Number.isNaN(v) || v < 0 || v > 255)) {
        const [h, s, v] = rgb2hsv([r, g, b]);
        const state = buildPickerState(h, s, v);
        // Preserve the raw typed rgb while updating HSV + hex
        setPickerState({ ...state, rgbInputValue: value });
        setSelectedColor(rgb2hex(hsv2rgb([h, s, v])));
        return;
      }
    }

    setPickerState((prev) => ({ ...prev, rgbInputValue: value }));
  });

  const handleHexInputBlur = useLastCallback(() => {
    setPickerState((prev) => ({ ...prev, hexInputValue: pickerColor.toUpperCase() }));
  });

  const handleRgbInputBlur = useLastCallback(() => {
    const rgb = hsv2rgb([pickerState.hue, pickerState.saturation, pickerState.brightness]);
    setPickerState((prev) => ({ ...prev, rgbInputValue: `${rgb[0]}, ${rgb[1]}, ${rgb[2]}` }));
  });

  const handleColorSelect = useLastCallback((color: string) => {
    setSelectedColor(color);
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
    hue: pickerState.hue,
    saturation: pickerState.saturation,
    brightness: pickerState.brightness,
    pickerColor,
    hexInputValue: pickerState.hexInputValue,
    rgbInputValue: pickerState.rgbInputValue,
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
