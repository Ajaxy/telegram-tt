import { memo, useEffect, useRef } from '../../../../lib/teact/teact';

import { requestMeasure, requestMutation } from '../../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../../util/buildClassName';

import styles from './GramTransferRibbon.module.scss';

type OwnProps = {
  color: string;
  text: string;
  className?: string;
};

const SIZE = 56;
// 40 of the 48 dp of the Android ribbon
const MAX_TEXT_WIDTH = 48;

// The ribbon says one of three words, so a word is measured once and every card in the chat reuses the result
const scaleByText = new Map<string, number>();
const SCALE_PROPERTY = '--ribbon-scale';

const GramTransferRibbon = ({ color, text, className }: OwnProps) => {
  const textRef = useRef<HTMLDivElement>();
  const scale = scaleByText.get(text);

  // A long word, such as the Russian for "sent", shrinks to the band, as in the Android app
  useEffect(() => {
    if (scale !== undefined) return;

    requestMeasure(() => {
      const element = textRef.current;
      if (!element) return;

      const measured = Math.min(1, MAX_TEXT_WIDTH / element.offsetWidth);
      scaleByText.set(text, measured);

      requestMutation(() => {
        element.style.setProperty(SCALE_PROPERTY, String(measured));
      });
    });
  }, [text, scale]);

  return (
    <div className={buildClassName(styles.root, className)}>
      <svg className={styles.band} width={SIZE} height={SIZE} viewBox="0 0 56 56" fill="none" aria-hidden="true">
        <path
          d="M52.4851 26.4853L29.5145 3.51472C27.2641 1.26428 24.2119 0 21.0293 0H2.82824C1.04643 0 0.154103 2.15429 1.41403 3.41422L52.5856 54.5858C53.8455 55.8457 55.9998 54.9534 55.9998 53.1716V34.9706C55.9998 31.788 54.7355 28.7357 52.4851 26.4853Z"
          style={`fill: ${color}`}
        />
      </svg>
      <div
        ref={textRef}
        className={styles.text}
        style={scale === undefined ? undefined : `${SCALE_PROPERTY}: ${scale}`}
      >
        {text}
      </div>
    </div>
  );
};

export default memo(GramTransferRibbon);
