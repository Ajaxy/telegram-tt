import type { ChangeEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import type React from '../../../lib/teact/teact';
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
  getPatternColor, hex2rgb, hsv2rgb, rgb2hex, rgb2hsv,
} from '../../../util/colors';
import { pick } from '../../../util/iteratees';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';

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
    offsetLeft: number;
    top: number;
    width: number;
    height: number;
  };
  hueRect: {
    offsetLeft: number;
    width: number;
  };
}

const DEFAULT_HSV = rgb2hsv(hex2rgb('e6ebee'));
const PREDEFINED_COLORS = [
  '#e6ebee', '#b2cee1', '#008dd0', '#c6e7cb', '#c4e1a6', '#60b16e',
  '#ccd0af', '#a6a997', '#7a7072', '#fdd7af', '#fdb76e', '#dd8851',
];

const SettingsGeneralBackground: FC<OwnProps & StateProps> = ({
  isActive,
  onReset,
  theme,
  backgroundColor,
}) => {
  const { setThemeSettings } = getActions();

  const themeRef = useRef<ThemeKey>();
  themeRef.current = theme;
  const containerRef = useRef<HTMLDivElement>();
  const colorPickerRef = useRef<HTMLDivElement>();
  const huePickerRef = useRef<HTMLDivElement>();
  const isFirstRunRef = useRef(true);

  const [hsv, setHsv] = useState(() => getInitialHsv(backgroundColor));
  // Cache for drag handlers
  const hsvRef = useRef(hsv);
  useEffect(() => {
    hsvRef.current = hsv;
  }, [hsv]);

  const [isDragging, markIsDragging, unmarkIsDragging] = useFlag();
  const [rgbInput, setRgbInput] = useState('');
  const [hexInput, setHexInput] = useState('');

  const rectsRef = useRef<CanvasRects>();
  const colorCtxRef = useRef<CanvasRenderingContext2D>();

  // Setup: cache rects, subscribe for drag events
  useEffect(() => {
    // We use `offsetLeft` instead of `left` to support screen transition
    const colorRect = {
      offsetLeft: colorPickerRef.current!.offsetLeft,
      ...pick(colorPickerRef.current!.getBoundingClientRect(), ['top', 'width', 'height']),
    };
    const hueRect = {
      offsetLeft: huePickerRef.current!.offsetLeft,
      ...pick(huePickerRef.current!.getBoundingClientRect(), ['width']),
    };

    rectsRef.current = { colorRect, hueRect };

    function handleColorDrag(e: MouseEvent | RealTouchEvent) {
      const colorPosition = [
        Math.min(Math.max(0, e.pageX! - colorRect.offsetLeft), colorRect.width - 1),
        Math.min(Math.max(0, e.pageY! - colorRect.top + containerRef.current!.scrollTop), colorRect.height - 1),
      ];

      const { huePosition } = hsv2positions(hsvRef.current, rectsRef.current!);

      setHsv(positions2hsv({ colorPosition, huePosition }, rectsRef.current!));
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
      const { colorPosition } = hsv2positions(hsvRef.current, rectsRef.current!);
      const huePosition = Math.min(Math.max(0, e.pageX! - hueRect.offsetLeft), hueRect.width - 1);

      setHsv(positions2hsv({ colorPosition, huePosition }, rectsRef.current!));
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

  const { colorPosition = [0, 0], huePosition = 0 } = rectsRef.current ? hsv2positions(hsv, rectsRef.current) : {};
  const hex = rgb2hex(hsv2rgb(hsv));
  const hue = hsv[0];
  const hueHex = rgb2hex(hsv2rgb([hue, 1, 1]));

  // Save value and update inputs when HSL changes
  useEffect(() => {
    const rgb = hsv2rgb(hsv);
    const color = rgb2hex(rgb);

    setRgbInput(rgb.join(', '));
    setHexInput(color);

    if (!isFirstRunRef.current) {
      const patternColor = getPatternColor(rgb);
      setThemeSettings({
        theme: themeRef.current!,
        background: undefined,
        backgroundColor: color,
        patternColor,
      });
    }
    isFirstRunRef.current = false;
  }, [hsv, setThemeSettings]);

  // Redraw color picker when hue changes
  useEffect(() => {
    drawColor(colorPickerRef.current!.firstChild as HTMLCanvasElement, hue, colorCtxRef, rectsRef);
  }, [hue]);

  // Initially draw hue picker
  useEffect(() => {
    drawHue(huePickerRef.current!.firstChild as HTMLCanvasElement);
  }, []);

  const handleRgbChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const rgbValue = e.currentTarget.value.replace(/[^\d, ]/g, '').slice(0, 13);

    if (rgbValue.match(/^\d{1,3},\s?\d{1,3},\s?\d{1,3}$/)) {
      const rgb = rgbValue.split(',').map((channel) => Number(channel.trim())) as [number, number, number];
      setHsv(rgb2hsv(rgb));
    }

    e.currentTarget.value = rgbValue;
  }, []);

  const handleHexChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const hexValue = e.currentTarget.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);

    if (hexValue.match(/^#?[0-9a-fA-F]{6}$/)) {
      setHsv(rgb2hsv(hex2rgb(hexValue)));
    }

    e.currentTarget.value = hexValue;
  }, []);

  const handlePredefinedColorClick = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    setHsv(rgb2hsv(hex2rgb(e.currentTarget.dataset.color!)));
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
      <div className="settings-item pt-3">
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
      </div>
      <div className="predefined-colors">
        {PREDEFINED_COLORS.map((color) => (
          <div
            className={buildClassName('predefined-color', color === hex ? 'active' : undefined)}
            data-color={color}
            style={`background-color: ${color};`}
            onClick={handlePredefinedColorClick}
          />
        ))}
      </div>
    </div>
  );
};

function getInitialHsv(backgroundColor?: string) {
  return backgroundColor?.startsWith('#')
    ? rgb2hsv(hex2rgb(backgroundColor))
    : DEFAULT_HSV;
}

function hsv2positions(hsv: [number, number, number], rects: CanvasRects) {
  return {
    colorPosition: [
      Math.round((hsv[1]) * (rects.colorRect.width - 1)),
      Math.round((1 - hsv[2]) * (rects.colorRect.height - 1)),
    ],
    huePosition: Math.round(hsv[0] * (rects.hueRect.width - 1)),
  };
}

function positions2hsv(
  { colorPosition, huePosition }: { colorPosition: number[]; huePosition: number },
  rects: CanvasRects,
): [number, number, number] {
  return [
    huePosition / (rects.hueRect.width - 1),
    colorPosition[0] / (rects.colorRect.width - 1),
    1 - colorPosition[1] / (rects.colorRect.height - 1),
  ];
}

function drawColor(
  canvas: HTMLCanvasElement,
  hue: number,
  colorCtxRef: React.RefObject<CanvasRenderingContext2D | undefined>,
  rectsRef: React.RefObject<CanvasRects | undefined>,
) {
  let w: number;
  let h: number;
  let ctx: CanvasRenderingContext2D;

  if (!colorCtxRef.current || !rectsRef.current) {
    // First run
    w = canvas.offsetWidth;
    h = canvas.offsetHeight;
    ctx = canvas.getContext('2d')!;

    canvas.width = w;
    canvas.height = h;

    colorCtxRef.current = ctx;
  } else {
    w = rectsRef.current.colorRect.width;
    h = rectsRef.current.colorRect.height;
    ctx = colorCtxRef.current;
  }

  const imgData = ctx!.createImageData(w, h);
  const pixels = imgData.data;
  const col = hsv2rgb([hue, 1, 1]);

  let index = 0;

  for (let y = 0; y < h; y++) {
    const perY = 1 - y / (h - 1);
    const st = [255 * perY, 255 * perY, 255 * perY];
    const ed = [col[0] * perY, col[1] * perY, col[2] * perY];
    for (let x = 0; x < w; x++) {
      const perX = x / (w - 1);
      pixels[index++] = st[0] + (ed[0] - st[0]) * perX;
      pixels[index++] = st[1] + (ed[1] - st[1]) * perX;
      pixels[index++] = st[2] + (ed[2] - st[2]) * perX;
      pixels[index++] = 255;
    }
  }

  ctx!.putImageData(imgData, 0, 0);
}

function drawHue(canvas: HTMLCanvasElement) {
  const w = canvas.offsetWidth;
  const h = 1;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const imgData = ctx.createImageData(w, h);
  const pixels = imgData.data;

  let index = 0;

  for (let x = 0; x < w; x++) {
    const hue = x / (w - 1);
    const rgb = hsv2rgb([hue, 1, 1]);

    pixels[index++] = rgb[0];
    pixels[index++] = rgb[1];
    pixels[index++] = rgb[2];

    pixels[index++] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
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
)(SettingsGeneralBackground));
