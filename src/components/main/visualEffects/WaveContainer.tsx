import React, {
  memo, useEffect, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { TabState } from '../../../global/types';

import { selectTabState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { addSvgDefinition, removeSvgDefinition, SVG_NAMESPACE } from '../../../util/svgController';
import windowSize from '../../../util/windowSize';

import useLastCallback from '../../../hooks/useLastCallback';

import styles from './WaveContainer.module.scss';

import waveRipple from '../../../assets/wave_ripple.svg';

type StateProps = {
  waveInfo?: TabState['wave'];
};

type Wave = {
  startTime: number;
  waveWidth: number;
  top: number;
  left: number;
};

const BASE_SIZE_MULTIPLIER = 1.73;
const FILTER_ID = 'wave-filter';
const FILTER_SCALE = '20';
const WAVE_COUNT_LIMIT = 7;

const WaveContainer = ({ waveInfo }: StateProps) => {
  const [waves, setWaves] = useState<Wave[]>([]);

  const addWave = useLastCallback((newWave: Wave) => {
    if (waves.length >= WAVE_COUNT_LIMIT) return;

    setWaves((prevWaves) => [...prevWaves, newWave]);
  });

  useEffect(() => {
    if (!waveInfo) return;

    const { startX, startY } = waveInfo;
    const { width, height } = windowSize.get();

    const maxSize = Math.max(width - startX, height - startY, startX, startY);
    const overlaySize = maxSize * BASE_SIZE_MULTIPLIER;
    const top = startY - overlaySize / 2;
    const left = startX - overlaySize / 2;

    addWave({
      startTime: waveInfo.lastWaveTime,
      waveWidth: overlaySize,
      top,
      left,
    });
  }, [waveInfo]);

  useEffect(() => {
    const filter = document.createElementNS(SVG_NAMESPACE, 'filter');
    filter.setAttribute('x', '0');
    filter.setAttribute('y', '0');
    filter.setAttribute('width', '1');
    filter.setAttribute('height', '1');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    addSvgDefinition(filter, FILTER_ID);

    const feImage = document.createElementNS(SVG_NAMESPACE, 'feImage');
    feImage.setAttribute('href', waveRipple);
    feImage.setAttribute('result', 'waveImage');
    filter.appendChild(feImage);

    const feDisplacementMap = document.createElementNS(SVG_NAMESPACE, 'feDisplacementMap');
    feDisplacementMap.setAttribute('in', 'SourceGraphic');
    feDisplacementMap.setAttribute('in2', 'waveImage');
    feDisplacementMap.setAttribute('scale', FILTER_SCALE);
    feDisplacementMap.setAttribute('xChannelSelector', 'R');
    feDisplacementMap.setAttribute('yChannelSelector', 'B');
    filter.appendChild(feDisplacementMap);

    return () => {
      removeSvgDefinition(FILTER_ID);
    };
  }, []);

  return (
    <div className={buildClassName(styles.root)} teactFastList>
      {waves.map((wave) => (
        <div
          className={styles.wave}
          style={buildStyle(
            `--wave-width: ${wave.waveWidth}px`,
            `--wave-pos-top: ${wave.top}px`,
            `--wave-pos-left: ${wave.left}px`,
          )}
          key={wave.startTime}
          onAnimationEnd={() => setWaves((prevWaves) => prevWaves.filter((w) => w !== wave))}
        />
      ))}
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const tabState = selectTabState(global);
    return {
      waveInfo: tabState.wave,
    };
  },
)(WaveContainer));
