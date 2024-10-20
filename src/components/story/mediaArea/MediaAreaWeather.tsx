import React, {
  type FC, memo, useRef, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiMediaAreaWeather, ApiSticker } from '../../../api/types';

import { selectRestrictedEmoji } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { convertToRGBA, getTextColor } from '../../../util/colors';
import { formatTemperature } from '../../../util/formatTemperature';
import { REM } from '../../common/helpers/mediaDimensions';

import useLastCallback from '../../../hooks/useLastCallback';
import useResizeObserver from '../../../hooks/useResizeObserver';

import CustomEmoji from '../../common/CustomEmoji';

import styles from './MediaArea.module.scss';

type OwnProps = {
  mediaArea: ApiMediaAreaWeather;
  className?: string;
  style?: string;
  isPreview?: boolean;
};

type StateProps = {
  restrictedEmoji?: ApiSticker;
};

const EMOJI_SIZE_MULTIPLIER = 0.7;
const TEMPERATURE_SIZE = 32;

const MediaAreaWeather: FC<OwnProps & StateProps> = ({
  mediaArea,
  className,
  style,
  restrictedEmoji,
  isPreview,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const [customEmojiSize, setCustomEmojiSize] = useState(1.5 * REM);
  const [customTemperatureSize, setCustomTemperatureSize] = useState(0);

  const { temperatureC, color } = mediaArea;

  const backgroundColor = convertToRGBA(color);
  const textColor = getTextColor(color);

  const updateCustomSize = useLastCallback(() => {
    if (!ref.current) return;
    const height = ref.current.clientHeight;
    setCustomEmojiSize(Math.round(height * EMOJI_SIZE_MULTIPLIER));
    setCustomTemperatureSize(height / TEMPERATURE_SIZE);
  });

  useResizeObserver(ref, updateCustomSize);

  return (
    <div
      ref={ref}
      className={buildClassName(className, styles.withBackground, isPreview && styles.border)}
      style={buildStyle(
        style,
        `--custom-emoji-size: ${customEmojiSize}px`,
        `--custom-background-color: ${backgroundColor}`,
      )}
    >
      <div className={styles.weatherInfo}>
        {restrictedEmoji && (
          <CustomEmoji
            key={restrictedEmoji.id}
            documentId={restrictedEmoji.id}
            size={customEmojiSize}
            noPlay={!isPreview}
            withTranslucentThumb
            forceAlways
          />
        )}
        <p
          className={styles.temperature}
          style={buildStyle(`font-size: ${customTemperatureSize}rem`, `color: ${textColor}`)}
        >
          {formatTemperature(temperatureC)}
        </p>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global, ownProps): StateProps => {
  const { mediaArea } = ownProps;
  const restrictedEmoji = selectRestrictedEmoji(global, mediaArea.emoji);
  return { restrictedEmoji };
})(MediaAreaWeather));
