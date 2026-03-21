import type { ElementRef } from '@teact';
import { memo } from '@teact';

import type { DrawTool } from './canvasUtils';

import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';

import useLang from '../../../hooks/useLang';
import { MAX_BRUSH_SIZE, MIN_BRUSH_SIZE } from './hooks/useDrawing';

import InputText from '../InputText';
import ListItem from '../ListItem';
import RangeSlider from '../RangeSlider';
import {
  ArrowSvg, BrushSvg, EraserSvg, NeonSvg, PenSvg,
} from './DrawToolSvgs';

import styles from './MediaEditor.module.scss';

interface ToolOption {
  id: DrawTool;
  labelKey: 'Pen' | 'Arrow' | 'Brush' | 'Neon' | 'Eraser';
  Icon: typeof PenSvg;
}

const DRAW_TOOLS: ToolOption[] = [
  { id: 'pen', labelKey: 'Pen', Icon: PenSvg },
  { id: 'arrow', labelKey: 'Arrow', Icon: ArrowSvg },
  { id: 'brush', labelKey: 'Brush', Icon: BrushSvg },
  { id: 'neon', labelKey: 'Neon', Icon: NeonSvg },
  { id: 'eraser', labelKey: 'Eraser', Icon: EraserSvg },
];

type OwnProps = {
  predefinedColors: string[];
  selectedColor: string;
  isColorPickerOpen: boolean;
  hue: number;
  saturation: number;
  brightness: number;
  pickerColor: string;
  hexInputValue: string;
  rgbInputValue: string;
  brushSize: number;
  drawTool: DrawTool;
  hueSliderRef: ElementRef<HTMLDivElement>;
  satBrightRef: ElementRef<HTMLDivElement>;
  onColorSelect: (color: string) => void;
  onOpenColorPicker: VoidFunction;
  onCloseColorPicker: VoidFunction;
  onHueSliderMouseDown: (e: React.MouseEvent) => void;
  onHueChange: (e: React.TouchEvent) => void;
  onSatBrightMouseDown: (e: React.MouseEvent) => void;
  onSatBrightChange: (e: React.TouchEvent) => void;
  onHexInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onHexInputBlur: VoidFunction;
  onRgbInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRgbInputBlur: VoidFunction;
  onBrushSizeChange: (size: number) => void;
  onToolChange: (tool: DrawTool) => void;
};

function DrawPanel({
  predefinedColors,
  selectedColor,
  isColorPickerOpen,
  hue,
  saturation,
  brightness,
  pickerColor,
  hexInputValue,
  rgbInputValue,
  brushSize,
  drawTool,
  hueSliderRef,
  satBrightRef,
  onColorSelect,
  onOpenColorPicker,
  onCloseColorPicker,
  onHueSliderMouseDown,
  onHueChange,
  onSatBrightMouseDown,
  onSatBrightChange,
  onHexInput,
  onHexInputBlur,
  onRgbInput,
  onRgbInputBlur,
  onBrushSizeChange,
  onToolChange,
}: OwnProps) {
  const lang = useLang();

  const hueDeg = hue * 360;

  return (
    <>
      <div className={styles.colorRow}>
        {isColorPickerOpen ? (
          <div
            ref={hueSliderRef}
            className={styles.hueSlider}
            onMouseDown={onHueSliderMouseDown}
            onTouchStart={onHueChange}
            onTouchMove={onHueChange}
          >
            <div
              className={styles.hueHandle}
              style={`--picker-hue: ${hueDeg}`}
            />
          </div>
        ) : predefinedColors.map((color) => (
          <button
            key={color}
            className={buildClassName(
              styles.colorSwatch,
              selectedColor === color && styles.selected,
            )}
            style={`--swatch-color: ${color}; --swatch-outline: ${color}1a`}
            onClick={() => onColorSelect(color)}
            aria-label={color}
          />
        ))}
        <button
          className={buildClassName(
            styles.colorSwatch,
            styles.customColor,
            isColorPickerOpen && styles.selected,
          )}
          onClick={isColorPickerOpen ? onCloseColorPicker : onOpenColorPicker}
          aria-label={lang('CustomColor')}
        />
      </div>

      {isColorPickerOpen && (
        <div className={styles.colorPickerInline}>
          <div className={styles.colorPickerRow}>
            <div
              ref={satBrightRef}
              className={styles.saturationBrightness}
              style={`--picker-hue: ${hueDeg}`}
              onMouseDown={onSatBrightMouseDown}
              onTouchStart={onSatBrightChange}
              onTouchMove={onSatBrightChange}
            >
              <div
                className={styles.satBrightHandle}
                style={buildStyle(
                  `--picker-sat: ${saturation * 100}%`,
                  `--picker-bright: ${(1 - brightness) * 100}%`,
                  `--picker-color: ${pickerColor}`,
                )}
              />
            </div>

            <div className={styles.colorInputs}>
              <InputText
                className={styles.colorInput}
                label={lang('HEX')}
                value={hexInputValue}
                onChange={onHexInput}
                onBlur={onHexInputBlur}
                maxLength={7}
              />
              <InputText
                className={styles.colorInput}
                label={lang('RGB')}
                value={rgbInputValue}
                onChange={onRgbInput}
                onBlur={onRgbInputBlur}
              />
            </div>
          </div>
        </div>
      )}

      <div className={styles.sizeRow} style={`--selected-color: ${selectedColor}`}>
        <span className={styles.sectionLabel}>
          {lang('Size')}
          <span className={styles.sizeValue}>{brushSize}</span>
        </span>
        <RangeSlider
          className={styles.sizeSlider}
          min={MIN_BRUSH_SIZE}
          max={MAX_BRUSH_SIZE}
          value={brushSize}
          onChange={onBrushSizeChange}
          bold
        />
      </div>

      <div className={styles.sectionLabel}>{lang('Tool')}</div>
      <div className={styles.toolList}>
        {DRAW_TOOLS.map((tool) => {
          const iconClassName = buildClassName(
            'ListItem-main-icon',
            styles.toolIcon,
            drawTool === tool.id && styles.toolIconActive,
          );
          return (
            <ListItem
              key={tool.id}
              focus={drawTool === tool.id}
              onClick={() => onToolChange(tool.id)}
            >
              <span className={iconClassName} style={`color: ${selectedColor}`}>
                <tool.Icon />
              </span>
              <span className={styles.toolLabel}>
                {lang(tool.labelKey)}
              </span>
            </ListItem>
          );
        })}
      </div>
    </>
  );
}

export default memo(DrawPanel);
