import {
  memo, useEffect, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { TabState } from '../../../global/types';

import { SVG_NAMESPACE } from '../../../config';
import { selectTabState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { addSvgDefinition, removeSvgDefinition } from '../../../util/svgController';
import windowSize from '../../../util/windowSize';

import useLastCallback from '../../../hooks/useLastCallback';

import styles from './WaveContainer.module.scss';

import waveRipple from '../../../assets/wave_ripple.jpg';

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
    addSvgDefinition(
      <filter x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB" xmlns={SVG_NAMESPACE}>
        <feImage href={waveRipple} result="waveImage" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="waveImage"
          scale={FILTER_SCALE}
          xChannelSelector="R"
          yChannelSelector="B"
        />
      </filter>,
      FILTER_ID,
    );

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
  (global): Complete<StateProps> => {
    const tabState = selectTabState(global);
    return {
      waveInfo: tabState.wave,
    };
  },
)(WaveContainer));
