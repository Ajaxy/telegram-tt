import Color from 'colorjs.io';
import {
  memo, useCallback, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ThemeKey } from '../../../types';
import type { RealTouchEvent } from '../../../util/captureEvents';

import { selectTheme, selectThemeValues } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { captureEvents } from '../../../util/captureEvents';
import {
  buildColorFromHex,
  buildHexFromColor,
  convertSrgbChannel,
  getPatternColor,
} from '../../../util/colors';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';

import Island from '../../gili/layout/Island';
import InputText from '../../ui/InputText';

import './SettingsGeneralBackgroundColor.scss';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  backgroundColor?: string;
  theme: ThemeKey;
};

interface CanvasRects {
  colorRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  hueRect: {
    left: number;
    width: number;
  };
}

const DEFAULT_BACKGROUND_COLOR = 'e6ebee';
const RGB_CHANNEL_MAX = 255;
const HSV_HUE_MAX = 360;
const COLOR_PERCENT_MAX = 100;
const RGB_INPUT_MAX_LENGTH = 13;
const HEX_INPUT_MAX_LENGTH = 6;
const RGB_COLOR_REGEX = /^(\d{1,3}),\s?(\d{1,3}),\s?(\d{1,3})$/;
const HEX_COLOR_REGEX = /^[0-9a-fA-F]{6}$/;
const PREDEFINED_COLORS = [
  '#e6ebee', '#b2cee1', '#008dd0', '#c6e7cb', '#c4e1a6', '#60b16e',
  '#ccd0af', '#a6a997', '#7a7072', '#fdd7af', '#fdb76e', '#dd8851',
];

const SettingsGeneralBackgroundColor = ({
  isActive,
  onReset,
  theme,
  backgroundColor,
}: OwnProps & StateProps) => {
  const { setThemeSettings } = getActions();

  const themeRef = useRef<ThemeKey>();
  themeRef.current = theme;
  const containerRef = useRef<HTMLDivElement>();
  const colorPickerRef = useRef<HTMLDivElement>();
  const huePickerRef = useRef<HTMLDivElement>();
  const isFirstRunRef = useRef(true);

  const [color, setColor] = useState(() => getInitialColor(backgroundColor));
  // Cache for drag handlers
  const colorRef = useRef(color);
  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  const [isDragging, markIsDragging, unmarkIsDragging] = useFlag();
  const [rgbInput, setRgbInput] = useState('');
  const [hexInput, setHexInput] = useState('');

  const rectsRef = useRef<CanvasRects>();
  const colorCtxRef = useRef<CanvasRenderingContext2D>();

  // Setup: cache rects, subscribe for drag events
  useEffect(() => {
    function updateRects() {
      const colorBounds = colorPickerRef.current!.getBoundingClientRect();
      const hueBounds = huePickerRef.current!.getBoundingClientRect();

      rectsRef.current = {
        colorRect: {
          left: colorBounds.left + window.scrollX,
          top: colorBounds.top + window.scrollY,
          width: colorBounds.width,
          height: colorBounds.height,
        },
        hueRect: {
          left: hueBounds.left + window.scrollX,
          width: hueBounds.width,
        },
      };

      return rectsRef.current;
    }

    updateRects();

    function handleColorDrag(e: MouseEvent | RealTouchEvent) {
      const rects = updateRects();
      const { colorRect } = rects;
      const colorPosition = [
        Math.min(Math.max(0, e.pageX! - colorRect.left), colorRect.width - 1),
        Math.min(Math.max(0, e.pageY! - colorRect.top), colorRect.height - 1),
      ];

      const { huePosition } = buildPositionsFromColor(colorRef.current, rects);

      setColor(buildColorFromPositions({ colorPosition, huePosition }, rects));
      markIsDragging();

      return true;
    }

    captureEvents(colorPickerRef.current!, {
      onCapture: handleColorDrag,
      onDrag: handleColorDrag,
      onRelease: unmarkIsDragging,
      onClick: unmarkIsDragging,
      selectorToPreventScroll: '.SettingsGeneralBackgroundColor',
      withCursor: true,
    });

    function handleHueDrag(e: MouseEvent | RealTouchEvent) {
      const rects = updateRects();
      const { colorPosition } = buildPositionsFromColor(colorRef.current, rects);
      const huePosition = Math.min(Math.max(0, e.pageX! - rects.hueRect.left), rects.hueRect.width - 1);

      setColor(buildColorFromPositions({ colorPosition, huePosition }, rects));
      markIsDragging();

      return true;
    }

    captureEvents(huePickerRef.current!, {
      onCapture: handleHueDrag,
      onDrag: handleHueDrag,
      onRelease: unmarkIsDragging,
      onClick: unmarkIsDragging,
      selectorToPreventScroll: '.SettingsGeneralBackgroundColor',
      withCursor: true,
    });
  }, [markIsDragging, unmarkIsDragging]);

  const { colorPosition = [0, 0], huePosition = 0 } = rectsRef.current
    ? buildPositionsFromColor(color, rectsRef.current) : {};
  const hex = buildHexFromColor(color);
  const [hueCoord] = color.to('hsv').coords;
  const hue = hueCoord || 0;
  const hueHex = buildHexFromColor(
    new Color('hsv', [hue, COLOR_PERCENT_MAX, COLOR_PERCENT_MAX]),
  );

  // Save value and update inputs when color changes
  useEffect(() => {
    const rgb = color.to('srgb').coords.map(convertSrgbChannel);
    const hexColor = buildHexFromColor(color);

    setRgbInput(rgb.join(', '));
    setHexInput(hexColor);

    if (!isFirstRunRef.current) {
      const patternColor = getPatternColor(color);
      setThemeSettings({
        theme: themeRef.current!,
        background: undefined,
        backgroundColor: hexColor,
        patternColor,
      });
    }
    isFirstRunRef.current = false;
  }, [color, setThemeSettings]);

  // Redraw color picker when hue changes
  useEffect(() => {
    drawColor(colorPickerRef.current!.firstChild as HTMLCanvasElement, hue, colorCtxRef, rectsRef);
  }, [hue]);

  // Initially draw hue picker
  useEffect(() => {
    drawHue(huePickerRef.current!.firstChild as HTMLCanvasElement);
  }, []);

  const handleRgbChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rgbValue = e.currentTarget.value.replace(/[^\d, ]/g, '').slice(0, RGB_INPUT_MAX_LENGTH);
    const rgbMatch = rgbValue.match(RGB_COLOR_REGEX);

    if (rgbMatch) {
      const red = Number(rgbMatch[1].trim());
      const green = Number(rgbMatch[2].trim());
      const blue = Number(rgbMatch[3].trim());
      setColor(new Color('srgb', [
        red / RGB_CHANNEL_MAX,
        green / RGB_CHANNEL_MAX,
        blue / RGB_CHANNEL_MAX,
      ]));
    }

    e.currentTarget.value = rgbValue;
  }, []);

  const handleHexChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const hexValue = e.currentTarget.value.replace(/[^0-9a-fA-F]/g, '').slice(0, HEX_INPUT_MAX_LENGTH);

    if (HEX_COLOR_REGEX.test(hexValue)) {
      setColor(buildColorFromHex(hexValue));
    }

    e.currentTarget.value = hexValue;
  }, []);

  const handlePredefinedColorClick = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    setColor(buildColorFromHex(e.currentTarget.dataset.color!));
  }, []);

  const className = buildClassName(
    'SettingsGeneralBackgroundColor settings-content custom-scroll',
    isDragging && 'is-dragging',
  );

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  return (
    <div ref={containerRef} className={className}>
      <Island>
        <div ref={colorPickerRef} className="color-picker">
          <canvas />
          <div
            className="handle"
            style={`transform: translate(${colorPosition[0]}px, ${colorPosition[1]}px); background-color: ${hex};`}
          />
        </div>
        <div ref={huePickerRef} className="hue-picker">
          <canvas />
          <div
            className="handle"
            style={`transform: translateX(${huePosition}px); background-color: ${hueHex};`}
          />
        </div>
        <div className="tools">
          <InputText value={hexInput} label="HEX" onChange={handleHexChange} />
          <InputText value={rgbInput} label="RGB" onChange={handleRgbChange} />
        </div>
      </Island>
      <div className="predefined-colors">
        {PREDEFINED_COLORS.map((predefinedColor) => (
          <div
            className={buildClassName('predefined-color', predefinedColor === hex ? 'active' : undefined)}
            data-color={predefinedColor}
            style={`background-color: ${predefinedColor};`}
            onClick={handlePredefinedColorClick}
          />
        ))}
      </div>
    </div>
  );
};

function getInitialColor(backgroundColor?: string) {
  const color = backgroundColor?.startsWith('#') ? backgroundColor : DEFAULT_BACKGROUND_COLOR;
  return buildColorFromHex(color);
}

function buildPositionsFromColor(color: Color, rects: CanvasRects) {
  const [hue, saturation, value] = color.to('hsv').coords;

  return {
    colorPosition: [
      Math.round((saturation! / COLOR_PERCENT_MAX) * (rects.colorRect.width - 1)),
      Math.round((1 - value! / COLOR_PERCENT_MAX) * (rects.colorRect.height - 1)),
    ],
    huePosition: Math.round(((hue || 0) / HSV_HUE_MAX) * (rects.hueRect.width - 1)),
  };
}

function buildColorFromPositions(
  { colorPosition, huePosition }: { colorPosition: number[]; huePosition: number },
  rects: CanvasRects,
) {
  return new Color('hsv', [
    (huePosition / (rects.hueRect.width - 1)) * HSV_HUE_MAX,
    (colorPosition[0] / (rects.colorRect.width - 1)) * COLOR_PERCENT_MAX,
    (1 - colorPosition[1] / (rects.colorRect.height - 1)) * COLOR_PERCENT_MAX,
  ]);
}

function drawColor(
  canvas: HTMLCanvasElement,
  hue: number,
  colorCtxRef: React.RefObject<CanvasRenderingContext2D | undefined>,
  rectsRef: React.RefObject<CanvasRects | undefined>,
) {
  let width: number;
  let height: number;
  let context: CanvasRenderingContext2D;

  if (!colorCtxRef.current || !rectsRef.current) {
    // First run
    width = canvas.offsetWidth;
    height = canvas.offsetHeight;
    context = canvas.getContext('2d')!;

    canvas.width = width;
    canvas.height = height;

    colorCtxRef.current = context;
  } else {
    width = rectsRef.current.colorRect.width;
    height = rectsRef.current.colorRect.height;
    context = colorCtxRef.current;
  }

  const imageData = context!.createImageData(width, height);
  const pixels = imageData.data;
  const [red, green, blue] = new Color('hsv', [hue, COLOR_PERCENT_MAX, COLOR_PERCENT_MAX])
    .to('srgb')
    .coords
    .map(convertSrgbChannel);

  let index = 0;

  for (let row = 0; row < height; row++) {
    const verticalProgress = 1 - row / (height - 1);
    const startRed = RGB_CHANNEL_MAX * verticalProgress;
    const startGreen = RGB_CHANNEL_MAX * verticalProgress;
    const startBlue = RGB_CHANNEL_MAX * verticalProgress;
    const endRed = red * verticalProgress;
    const endGreen = green * verticalProgress;
    const endBlue = blue * verticalProgress;

    for (let column = 0; column < width; column++) {
      const horizontalProgress = column / (width - 1);
      pixels[index++] = startRed + (endRed - startRed) * horizontalProgress;
      pixels[index++] = startGreen + (endGreen - startGreen) * horizontalProgress;
      pixels[index++] = startBlue + (endBlue - startBlue) * horizontalProgress;
      pixels[index++] = RGB_CHANNEL_MAX;
    }
  }

  context!.putImageData(imageData, 0, 0);
}

function drawHue(canvas: HTMLCanvasElement) {
  const width = canvas.offsetWidth;
  const height = 1;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;

  const imageData = context.createImageData(width, height);
  const pixels = imageData.data;

  let index = 0;

  for (let column = 0; column < width; column++) {
    const hue = (column / (width - 1)) * HSV_HUE_MAX;
    const [red, green, blue] = new Color('hsv', [hue, COLOR_PERCENT_MAX, COLOR_PERCENT_MAX])
      .to('srgb')
      .coords
      .map(convertSrgbChannel);

    pixels[index++] = red;
    pixels[index++] = green;
    pixels[index++] = blue;

    pixels[index++] = RGB_CHANNEL_MAX;
  }

  context.putImageData(imageData, 0, 0);
}

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const theme = selectTheme(global);
    const { backgroundColor } = selectThemeValues(global, theme) || {};
    return {
      backgroundColor,
      theme,
    };
  },
)(SettingsGeneralBackgroundColor));
