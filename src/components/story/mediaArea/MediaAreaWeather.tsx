import {
  type FC, memo,
  useLayoutEffect,
  useRef, useState,
} from '../../../lib/teact/teact';
import { setExtraStyles } from '../../../lib/teact/teact-dom';
import { withGlobal } from '../../../global';

import type { ApiMediaAreaWeather, ApiSticker } from '../../../api/types';

import { requestForcedReflow, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { selectRestrictedEmoji } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { getTextColor, int2cssRgba } from '../../../util/colors';
import { formatTemperature } from '../../../util/formatTemperature';

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
  const ref = useRef<HTMLDivElement>();
  const [customEmojiSize, setCustomEmojiSize] = useState(0);

  const { temperatureC, color } = mediaArea;

  const backgroundColor = int2cssRgba(color);
  const textColor = getTextColor(color);

  const updateCustomSize = useLastCallback((isImmediate?: boolean) => {
    if (!ref.current) return undefined;
    const el = ref.current;

    const height = el.clientHeight;
    const customEmojiHeight = Math.round(height * EMOJI_SIZE_MULTIPLIER);
    setCustomEmojiSize(customEmojiHeight);
    const applyFn = () => {
      setExtraStyles(el, {
        '--custom-emoji-size': `${customEmojiHeight}px`,
        'font-size': `${height / TEMPERATURE_SIZE}rem`,
      });
    };

    if (isImmediate) return applyFn;

    requestMutation(applyFn);

    return undefined;
  });

  useLayoutEffect(() => {
    requestForcedReflow(() => updateCustomSize(true));
  }, []);

  useResizeObserver(ref, () => updateCustomSize());

  return (
    <div
      ref={ref}
      className={buildClassName(styles.weather, className)}
      style={buildStyle(
        style,
        `--custom-background-color: ${backgroundColor}`,
        `color: ${textColor}`,
      )}
    >
      <div className={styles.weatherInner}>
        {restrictedEmoji && (
          <CustomEmoji
            key={restrictedEmoji.id}
            documentId={restrictedEmoji.id}
            size={customEmojiSize}
            noPlay={isPreview}
            withTranslucentThumb
            forceAlways
          />
        )}
        <p className={styles.temperature}>
          {formatTemperature(temperatureC)}
        </p>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global, ownProps): Complete<StateProps> => {
  const { mediaArea } = ownProps;
  const restrictedEmoji = selectRestrictedEmoji(global, mediaArea.emoji);
  return { restrictedEmoji };
})(MediaAreaWeather));
