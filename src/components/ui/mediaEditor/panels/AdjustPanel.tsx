import { memo, useMemo, useState } from '@teact';

import type {
  AdjustmentKey, CurveChannel, CurvesState, MediaEditDocument,
} from '../../../../types/mediaEditor';
import type { EditorPanelProps } from '../types';

import buildClassName from '../../../../util/buildClassName';
import { CURVE_CHANNELS, isCurvesDefault } from '../render/adjustments/curves';
import {
  ADJUSTMENT_TOOLS, type AdjustmentTool, TINT_HIGHLIGHTS_COLORS, TINT_SHADOWS_COLORS,
} from '../render/adjustments/values';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useShowTransition from '../../../../hooks/useShowTransition';

import TabList from '../../TabList';
import CurvesEditor from './CurvesEditor';
import QualitySection from './QualitySection';
import Island, { IslandTitle } from '@gili/layout/Island';
import Slider from '@gili/primitives/Slider';
import SliderField from '@gili/templates/SliderField';

import styles from '../MediaEditor.module.scss';

type TintColorKey = 'shadowsColor' | 'highlightsColor';
type ResettableSection = 'adjustments' | 'tint' | 'curves';

const MAX_ADJUSTMENT = 100;
const SECTION_LABEL_KEYS = {
  adjustments: 'EditorAdjustments', tint: 'Tint', curves: 'Curves',
} as const;
const CURVE_LABEL_KEYS = {
  all: 'CurvesAll', red: 'CurvesRed', green: 'CurvesGreen', blue: 'CurvesBlue',
} as const;
const TINT_ROWS: { key: TintColorKey; labelKey: 'TintShadows' | 'TintHighlights'; colors: string[] }[] = [
  { key: 'shadowsColor', labelKey: 'TintShadows', colors: TINT_SHADOWS_COLORS },
  { key: 'highlightsColor', labelKey: 'TintHighlights', colors: TINT_HIGHLIGHTS_COLORS },
];

function AdjustPanel({
  doc,
  isVideo,
  canAdjustColors,
  videoQuality,
  getDoc,
  onPreview,
  onCommit,
}: EditorPanelProps) {
  const lang = useLang();
  const [curveChannel, setCurveChannel] = useState<CurveChannel>('all');
  const { adjustments, tint, curves } = doc;

  const tools = useMemo(() => ADJUSTMENT_TOOLS.filter((tool) => !isVideo || !tool.isPhotoOnly), [isVideo]);
  const curveTabs = useMemo(() => (
    CURVE_CHANNELS.map((channel) => ({ title: lang(CURVE_LABEL_KEYS[channel]) }))
  ), [lang]);

  const buildAdjustedDoc = (key: AdjustmentKey, value?: number): MediaEditDocument => {
    const currentDoc = getDoc();
    return { ...currentDoc, adjustments: { ...currentDoc.adjustments, [key]: value || undefined } };
  };

  const handleAdjustmentChange = useLastCallback((key: AdjustmentKey, value: number) => {
    onPreview(buildAdjustedDoc(key, value));
  });

  const handleAdjustmentReset = useLastCallback((key: AdjustmentKey) => {
    onCommit(buildAdjustedDoc(key));
  });

  const handleChangeEnd = useLastCallback(() => {
    onCommit(getDoc());
  });

  const handleSectionReset = useLastCallback((section: ResettableSection) => {
    onCommit({ ...getDoc(), [section]: undefined });
  });

  const handleTintColorSelect = useLastCallback((key: TintColorKey, color?: string) => {
    const currentDoc = getDoc();
    onCommit({ ...currentDoc, tint: { ...currentDoc.tint, [key]: color } });
  });

  const handleCurveChannelSwitch = useLastCallback((index: number) => {
    setCurveChannel(CURVE_CHANNELS[index]);
  });

  const handleCurvesPreview = useLastCallback((newCurves: CurvesState) => {
    onPreview({ ...getDoc(), curves: newCurves });
  });

  const handleCurvesCommit = useLastCallback((newCurves: CurvesState) => {
    onCommit({ ...getDoc(), curves: isCurvesDefault(newCurves) ? undefined : newCurves });
  });

  const hasAdjustments = Boolean(adjustments && Object.values(adjustments).some(Boolean));
  const hasTint = Boolean(tint?.shadowsColor || tint?.highlightsColor);
  const hasCurves = Boolean(curves && !isCurvesDefault(curves));

  function renderTintRing(key: TintColorKey, color?: string) {
    const isSelected = tint?.[key] === color;

    return (
      <button
        type="button"
        key={color}
        aria-pressed={isSelected}
        className={buildClassName(styles.tintRing, isSelected && styles.selected)}
        style={color ? `--ring-color: ${color}` : undefined}
        aria-label={color ?? lang('EditorTintNone')}
        onClick={() => handleTintColorSelect(key, color)}
      />
    );
  }

  return (
    <div className={styles.adjustPanel}>
      {videoQuality && <QualitySection {...videoQuality} />}
      {canAdjustColors && (
        <>
          <SectionTitle section="adjustments" isChanged={hasAdjustments} onReset={handleSectionReset} />
          <Island>
            {tools.map((tool) => (
              <AdjustmentRow
                key={tool.key}
                tool={tool}
                value={adjustments?.[tool.key] ?? 0}
                onChange={handleAdjustmentChange}
                onChangeEnd={handleChangeEnd}
                onReset={handleAdjustmentReset}
              />
            ))}
          </Island>

          <SectionTitle section="tint" isChanged={hasTint} onReset={handleSectionReset} />
          <Island className={styles.tintIsland}>
            {TINT_ROWS.map(({ key, labelKey, colors }) => (
              <>
                <span className={styles.tintLabel}>{lang(labelKey)}</span>
                <div className={styles.tintRings} role="group" aria-label={lang(labelKey)}>
                  {renderTintRing(key)}
                  {colors.map((color) => renderTintRing(key, color))}
                </div>
              </>
            ))}
          </Island>

          <SectionTitle section="curves" isChanged={hasCurves} onReset={handleSectionReset} />
          <Island>
            <TabList
              tabs={curveTabs}
              activeTab={CURVE_CHANNELS.indexOf(curveChannel)}
              stretched
              onSwitchTab={handleCurveChannelSwitch}
            />
            <CurvesEditor
              curves={curves}
              channel={curveChannel}
              onPreview={handleCurvesPreview}
              onCommit={handleCurvesCommit}
            />
          </Island>
        </>
      )}
    </div>
  );
}

const SectionTitle = memo(({
  section,
  isChanged,
  onReset,
}: {
  section: ResettableSection;
  isChanged: boolean;
  onReset: (section: ResettableSection) => void;
}) => {
  const lang = useLang();
  const { ref, shouldRender } = useShowTransition<HTMLButtonElement>({
    isOpen: isChanged,
    noMountTransition: true,
    withShouldRender: true,
  });

  const handleReset = useLastCallback(() => {
    onReset(section);
  });

  return (
    <IslandTitle className={styles.sectionTitle}>
      {lang(SECTION_LABEL_KEYS[section])}
      {shouldRender && (
        <button ref={ref} type="button" className={styles.sectionReset} onClick={handleReset}>
          {lang('Reset')}
        </button>
      )}
    </IslandTitle>
  );
});

const AdjustmentRow = memo(({
  tool,
  value,
  onChange,
  onChangeEnd,
  onReset,
}: {
  tool: AdjustmentTool;
  value: number;
  onChange: (key: AdjustmentKey, value: number) => void;
  onChangeEnd: NoneToVoidFunction;
  onReset: (key: AdjustmentKey) => void;
}) => {
  const lang = useLang();

  const handleChange = useLastCallback((newValue: number) => {
    onChange(tool.key, newValue);
  });

  const handleReset = useLastCallback(() => {
    onReset(tool.key);
  });

  return (
    <SliderField label={lang(tool.labelKey)} value={formatAdjustmentValue(value)} isValueAccented={value !== 0}>
      <Slider
        min={tool.min}
        max={MAX_ADJUSTMENT}
        value={value}
        aria-label={lang(tool.labelKey)}
        onChange={handleChange}
        onChangeEnd={onChangeEnd}
        onReset={handleReset}
      />
    </SliderField>
  );
});

function formatAdjustmentValue(value: number) {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return '0';
}

export default memo(AdjustPanel);
