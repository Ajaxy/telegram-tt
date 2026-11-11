import { memo, useEffect } from '@teact';

import buildClassName from '../../../../util/buildClassName';
import buildStyle from '../../../../util/buildStyle';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';

import useLang from '../../../../hooks/useLang';
import useWindow from '../../../../hooks/useWindow';
import useColorPicker from '../hooks/useColorPicker';

import InputText from '../../InputText';
import Island from '@gili/layout/Island';

import styles from '../MediaEditor.module.scss';

type OwnProps = {
  colors: string[];
  initialColor: string;
  isActive?: boolean;
  onChange: (color: string, isPreview?: boolean) => void;
};

const HUE_DEGREES = 360;
const PERCENT = 100;

function ColorPicker({
  colors,
  initialColor,
  isActive,
  onChange,
}: OwnProps) {
  const lang = useLang();
  const renderingWindow = useWindow();

  const {
    hueSliderRef,
    satBrightRef,
    selectedColor,
    isColorPickerOpen,
    openColorPicker,
    closeColorPicker,
    hue,
    saturation,
    brightness,
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
    handleTouchEnd,
  } = useColorPicker({ initialColor, onChange });

  useEffect(() => {
    return isColorPickerOpen && isActive
      ? captureEscKeyListener(closeColorPicker, renderingWindow.document)
      : undefined;
  }, [isColorPickerOpen, isActive, closeColorPicker, renderingWindow]);

  const hueDeg = hue * HUE_DEGREES;
  const isCustomColor = !colors.includes(selectedColor);

  return (
    <Island className={buildClassName(styles.colorPicker, isColorPickerOpen && styles.colorPickerOpen)}>
      <div className={styles.colorRow}>
        {colors.map((color) => {
          const isSelected = color === selectedColor;

          return (
            <button
              type="button"
              key={color}
              className={buildClassName(styles.colorSwatch, isSelected && styles.selected)}
              style={`--swatch-color: ${color}; --swatch-outline: ${color}1a`}
              aria-label={color}
              aria-pressed={isSelected}
              inert={isColorPickerOpen}
              onClick={() => handleColorSelect(color)}
            />
          );
        })}
        <button
          type="button"
          className={buildClassName(
            styles.colorSwatch,
            styles.customColor,
            (isColorPickerOpen || isCustomColor) && styles.selected,
          )}
          aria-label={lang('CustomColor')}
          aria-expanded={isColorPickerOpen}
          onClick={isColorPickerOpen ? closeColorPicker : openColorPicker}
        />
        <div
          className={styles.hueSlider}
          aria-hidden={!isColorPickerOpen}
          onMouseDown={handleHueSliderMouseDown}
          onTouchStart={handleHueChange}
          onTouchMove={handleHueChange}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <div ref={hueSliderRef} className={styles.pickerArea}>
            <div className={styles.hueHandle} style={`--picker-hue: ${hueDeg}`} />
          </div>
        </div>
      </div>

      <div
        className={buildClassName(styles.collapsible, isColorPickerOpen && styles.expanded)}
        aria-hidden={!isColorPickerOpen}
        inert={!isColorPickerOpen}
      >
        <div className={styles.colorPickerRow}>
          <div
            className={styles.saturationBrightness}
            style={`--picker-hue: ${hueDeg}`}
            onMouseDown={handleSatBrightMouseDown}
            onTouchStart={handleSatBrightChange}
            onTouchMove={handleSatBrightChange}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <div ref={satBrightRef} className={styles.pickerArea}>
              <div
                className={styles.satBrightHandle}
                style={buildStyle(
                  `--picker-sat: ${saturation * PERCENT}%`,
                  `--picker-bright: ${(1 - brightness) * PERCENT}%`,
                  `--picker-color: ${selectedColor}`,
                )}
              />
            </div>
          </div>

          <div className={styles.colorInputs}>
            <InputText
              className={styles.colorInput}
              label={lang('HEX')}
              value={hexInputValue}
              maxLength={7}
              noMargin
              onChange={handleHexInput}
              onBlur={handleHexInputBlur}
            />
            <InputText
              className={styles.colorInput}
              label={lang('RGB')}
              value={rgbInputValue}
              noMargin
              onChange={handleRgbInput}
              onBlur={handleRgbInputBlur}
            />
          </div>
        </div>
      </div>
    </Island>
  );
}

export default memo(ColorPicker);
