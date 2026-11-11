import { memo } from '@teact';

import type { DrawTool } from '../../../../types/mediaEditor';
import type { EditorPanelProps } from '../types';

import buildClassName from '../../../../util/buildClassName';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import { PREDEFINED_COLORS } from '../hooks/useColorPicker';
import { MAX_BRUSH_SIZE, MIN_BRUSH_SIZE } from '../hooks/useDrawing';

import ListItem from '../../ListItem';
import {
  ArrowSvg, BrushSvg, EraserSvg, NeonSvg, PenSvg,
} from '../canvas/DrawToolSvgs';
import ColorPicker from './ColorPicker';
import Island, { IslandTitle } from '@gili/layout/Island';
import Slider from '@gili/primitives/Slider';
import SliderField from '@gili/templates/SliderField';

import styles from '../MediaEditor.module.scss';

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

function DrawPanel({
  drawSettings,
  isActive,
  onDrawSettingsChange,
}: EditorPanelProps) {
  const lang = useLang();

  const handleColorChange = useLastCallback((color: string, isPreview?: boolean) => {
    onDrawSettingsChange({ ...drawSettings, color }, isPreview);
  });

  const handleBrushSizeChange = useLastCallback((size: number) => {
    onDrawSettingsChange({ ...drawSettings, size }, true);
  });

  const handleBrushSizeChangeEnd = useLastCallback((size: number) => {
    onDrawSettingsChange({ ...drawSettings, size });
  });

  const handleToolChange = useLastCallback((tool: DrawTool) => {
    onDrawSettingsChange({ ...drawSettings, tool });
  });

  return (
    <div className={styles.adjustPanel}>
      <ColorPicker
        colors={PREDEFINED_COLORS}
        initialColor={drawSettings.color}
        isActive={isActive}
        onChange={handleColorChange}
      />

      <Island>
        <SliderField label={lang('Size')} value={drawSettings.size} style={`--ui-accent-color: ${drawSettings.color}`}>
          <Slider
            min={MIN_BRUSH_SIZE}
            max={MAX_BRUSH_SIZE}
            value={drawSettings.size}
            aria-label={lang('Size')}
            onChange={handleBrushSizeChange}
            onChangeEnd={handleBrushSizeChangeEnd}
          />
        </SliderField>
      </Island>

      <IslandTitle>{lang('Tool')}</IslandTitle>
      <Island>
        {DRAW_TOOLS.map((tool) => (
          <ListItem
            key={tool.id}
            focus={drawSettings.tool === tool.id}
            onClick={() => handleToolChange(tool.id)}
          >
            <span
              className={buildClassName('ListItem-main-icon', styles.toolIcon)}
              style={`color: ${drawSettings.color}`}
            >
              <tool.Icon />
            </span>
            <span className={styles.toolLabel}>
              {lang(tool.labelKey)}
            </span>
          </ListItem>
        ))}
      </Island>
    </div>
  );
}

export default memo(DrawPanel);
