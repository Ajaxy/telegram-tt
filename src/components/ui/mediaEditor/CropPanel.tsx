import { memo } from '@teact';

import type { AspectRatio } from './hooks/useCropper';

import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';
import { ASPECT_RATIOS } from './hooks/useCropper';

import Icon from '../../common/icons/Icon';
import ListItem from '../ListItem';

import styles from './MediaEditor.module.scss';

type OwnProps = {
  currentRatio: AspectRatio;
  onRatioChange: (ratio: AspectRatio) => void;
};

const RATIO_ICON_CLASSES: Partial<Record<AspectRatio, string>> = {
  square: styles.ratio1x1,
  '3:2': styles.ratio3x2,
  '2:3': styles.ratio2x3,
  '4:3': styles.ratio4x3,
  '3:4': styles.ratio3x4,
  '5:4': styles.ratio5x4,
  '4:5': styles.ratio4x5,
  '16:9': styles.ratio16x9,
  '9:16': styles.ratio9x16,
};

// First 3 ratios are displayed as full-width items
const FULL_WIDTH_RATIOS = ASPECT_RATIOS.slice(0, 3);

// Remaining ratios are displayed in pairs
const PAIRED_RATIOS = ASPECT_RATIOS.slice(3);

function CropPanel({ currentRatio, onRatioChange }: OwnProps) {
  const lang = useLang();

  const renderRatioIcon = (value: AspectRatio) => {
    if (value === 'free') {
      return <Icon name="fullscreen" className="ListItem-main-icon" />;
    }
    if (value === 'original') {
      return <Icon name="photo" className="ListItem-main-icon" />;
    }
    return <div className={buildClassName('ListItem-main-icon', styles.ratioBox, RATIO_ICON_CLASSES[value])} />;
  };

  const renderRatioLabel = (option: typeof ASPECT_RATIOS[number]) => {
    if (option.labelKey) {
      return lang(option.labelKey);
    }
    return option.label;
  };

  const renderPairedRows = () => {
    // Generate row indices for paired ratios (0, 2, 4, ...)
    const rowIndices = Array.from({ length: Math.ceil(PAIRED_RATIOS.length / 2) }, (_, i) => i * 2);

    return rowIndices.map((i) => {
      const leftRatio = PAIRED_RATIOS[i];
      const rightRatio = PAIRED_RATIOS[i + 1];

      return (
        <div key={i} className={styles.aspectRatioRow}>
          <ListItem
            focus={currentRatio === leftRatio.value}
            onClick={() => onRatioChange(leftRatio.value)}
          >
            {renderRatioIcon(leftRatio.value)}
            {leftRatio.label}
          </ListItem>
          {rightRatio && (
            <ListItem
              focus={currentRatio === rightRatio.value}
              onClick={() => onRatioChange(rightRatio.value)}
            >
              {renderRatioIcon(rightRatio.value)}
              {rightRatio.label}
            </ListItem>
          )}
        </div>
      );
    });
  };

  return (
    <>
      <div className={styles.sectionLabel}>{lang('AspectRatio')}</div>
      <div className={styles.aspectRatioList}>
        {FULL_WIDTH_RATIOS.map((option) => (
          <ListItem
            key={option.value}
            focus={currentRatio === option.value}
            onClick={() => onRatioChange(option.value)}
          >
            {renderRatioIcon(option.value)}
            {renderRatioLabel(option)}
          </ListItem>
        ))}
        {renderPairedRows()}
      </div>
    </>
  );
}

export default memo(CropPanel);
