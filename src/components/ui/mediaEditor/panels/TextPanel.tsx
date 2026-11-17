import { memo } from '@teact';

import type { IconName } from '../../../../types/icons';
import type { TextLayerAlign, TextLayerFont, TextLayerStyle } from '../../../../types/mediaEditor';
import type { EditorPanelProps } from '../types';

import buildClassName from '../../../../util/buildClassName';
import stopEvent from '../../../../util/stopEvent';
import { TEXT_FONTS } from '../render/layers';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import { PREDEFINED_COLORS } from '../hooks/useColorPicker';

import Icon from '../../../common/icons/Icon';
import ListItem from '../../ListItem';
import { TextFilledSvg, TextPlainSvg, TextSemiSvg } from '../canvas/TextStyleSvgs';
import ColorPicker from './ColorPicker';
import Island, { IslandDescription, IslandTitle } from '@gili/layout/Island';
import Slider from '@gili/primitives/Slider';
import SliderField from '@gili/templates/SliderField';

import styles from '../MediaEditor.module.scss';

type FontOption = {
  id: TextLayerFont;
  name: string;
};

type StyleOption = {
  id: TextLayerStyle;
  labelKey: 'EditorTextPlain' | 'EditorTextFilled' | 'EditorTextSemi';
  Icon: typeof TextPlainSvg;
};

const FONTS: FontOption[] = [
  { id: 'roboto', name: 'Roboto' },
  { id: 'suez', name: 'Suez One' },
  { id: 'fugaz', name: 'Fugaz One' },
  { id: 'courier', name: 'Courier Prime' },
  { id: 'chewy', name: 'Chewy' },
  { id: 'sedan', name: 'Sedan' },
  { id: 'bubbles', name: 'Rubik Bubbles' },
  { id: 'playwrite', name: 'Playwrite' },
];
const STYLES: StyleOption[] = [
  { id: 'plain', labelKey: 'EditorTextPlain', Icon: TextPlainSvg },
  { id: 'filled', labelKey: 'EditorTextFilled', Icon: TextFilledSvg },
  { id: 'semi', labelKey: 'EditorTextSemi', Icon: TextSemiSvg },
];
const ALIGNS: { id: TextLayerAlign; icon: IconName; labelKey: 'EditorTextAlignLeft' | 'EditorTextAlignCenter'
  | 'EditorTextAlignRight'; }[] = [
  { id: 'left', icon: 'table-align-left', labelKey: 'EditorTextAlignLeft' },
  { id: 'center', icon: 'table-align-center', labelKey: 'EditorTextAlignCenter' },
  { id: 'right', icon: 'table-align-right', labelKey: 'EditorTextAlignRight' },
];
const SIZE_SCALE = 400;
const MIN_SIZE = 8;
const MAX_SIZE = 60;

function TextPanel({
  textSettings,
  isActive,
  onTextSettingsChange,
}: EditorPanelProps) {
  const lang = useLang();

  const handleColorChange = useLastCallback((color: string, isPreview?: boolean) => {
    onTextSettingsChange({ ...textSettings, color }, isPreview);
  });

  const handleSizeChange = useLastCallback((value: number) => {
    onTextSettingsChange({ ...textSettings, size: value / SIZE_SCALE }, true);
  });

  const handleSizeChangeEnd = useLastCallback((value: number) => {
    onTextSettingsChange({ ...textSettings, size: value / SIZE_SCALE });
  });

  const size = Math.round(textSettings.size * SIZE_SCALE);

  return (
    <div className={styles.adjustPanel}>
      <IslandDescription>{lang('EditorTextHint')}</IslandDescription>
      <ColorPicker
        colors={PREDEFINED_COLORS}
        initialColor={textSettings.color}
        isActive={isActive}
        onChange={handleColorChange}
      />

      <Island className={styles.toggleRow}>
        <div className={styles.toggleGroup}>
          {ALIGNS.map(({ id, icon, labelKey }) => (
            <button
              type="button"
              key={id}
              className={buildClassName(styles.toggleButton, textSettings.align === id && styles.active)}
              aria-label={lang(labelKey)}
              aria-pressed={textSettings.align === id}
              onMouseDown={stopEvent}
              onClick={() => onTextSettingsChange({ ...textSettings, align: id })}
            >
              <Icon name={icon} />
            </button>
          ))}
        </div>
        <div className={styles.toggleGroup}>
          {STYLES.map(({ id, labelKey, Icon: StyleIcon }) => (
            <button
              type="button"
              key={id}
              className={buildClassName(styles.toggleButton, textSettings.style === id && styles.active)}
              aria-label={lang(labelKey)}
              aria-pressed={textSettings.style === id}
              onMouseDown={stopEvent}
              onClick={() => onTextSettingsChange({ ...textSettings, style: id })}
            >
              <StyleIcon />
            </button>
          ))}
        </div>
      </Island>

      <Island>
        <SliderField label={lang('Size')} value={size} style={`--ui-accent-color: ${textSettings.color}`}>
          <Slider
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={size}
            aria-label={lang('Size')}
            onChange={handleSizeChange}
            onChangeEnd={handleSizeChangeEnd}
          />
        </SliderField>
      </Island>

      <IslandTitle>{lang('EditorFont')}</IslandTitle>
      <Island>
        {FONTS.map(({ id, name }) => {
          const { family, weight } = TEXT_FONTS[id];

          return (
            <ListItem
              key={id}
              focus={textSettings.font === id}
              onClick={() => onTextSettingsChange({ ...textSettings, font: id })}
            >
              <span style={`font-family: ${family}; font-weight: ${weight}`}>{name}</span>
            </ListItem>
          );
        })}
      </Island>
    </div>
  );
}

export default memo(TextPanel);
