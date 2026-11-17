import { memo } from '@teact';

import type { VideoQualityControl } from '../types';

import buildClassName from '../../../../util/buildClassName';
import { formatFileSize } from '../../../../util/text/textFormat';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Island, { IslandDescription } from '@gili/layout/Island';
import StepSlider from '@gili/primitives/StepSlider';
import SliderField from '@gili/templates/SliderField';

import styles from '../MediaEditor.module.scss';

const VIDEO_FORMAT_NAME = 'MP4';
const GIF_FORMAT_NAME = 'GIF';

function QualitySection({
  levels,
  level,
  originalLevel,
  outputSize,
  estimatedSize,
  isGif,
  onChange,
}: VideoQualityControl) {
  const lang = useLang();
  const levelIndex = level ? levels.indexOf(level) : -1;
  const selectedIndex = levelIndex === -1 ? levels.length : levelIndex;
  const selectedLabel = `${levels[selectedIndex] ?? originalLevel}p`;

  const handleChange = useLastCallback((index: number) => {
    onChange(levels[index]);
  });

  return (
    <>
      <Island>
        <SliderField label={lang('Quality')} value={selectedLabel}>
          <StepSlider
            stepCount={levels.length + 1}
            value={selectedIndex}
            disabled={isGif}
            aria-label={lang('Quality')}
            aria-valuetext={selectedLabel}
            onChange={handleChange}
          />
        </SliderField>
      </Island>
      <IslandDescription>
        {lang('VideoQualityInfo', {
          type: isGif ? GIF_FORMAT_NAME : VIDEO_FORMAT_NAME,
          size: formatFileSize(lang, estimatedSize),
          width: String(outputSize.width),
          height: String(outputSize.height),
        })}
        <div className={buildClassName(styles.collapsible, isGif && styles.expanded)} aria-hidden={!isGif}>
          <div className={styles.collapsibleContent}>{lang('VideoQualityGifHint')}</div>
        </div>
      </IslandDescription>
    </>
  );
}

export default memo(QualitySection);
