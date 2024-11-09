import React, { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ThemeKey } from '../../../types';

import { selectTheme } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useUniqueId from '../../../hooks/useUniqueId';

import styles from './GiftRibbon.module.scss';

const COLORS = {
  red: [['#FF5B54', '#ED1C26'], ['#653633', '#532224']],
  blue: [['#6ED2FF', '#34A4FC'], ['#344F5A', '#152E42']],
} as const;
type ColorKey = keyof typeof COLORS;

const COLOR_KEYS = new Set(Object.keys(COLORS) as ColorKey[]);

type OwnProps = {
  color: ColorKey | string;
  text: string;
  className?: string;
};

type StateProps = {
  theme: ThemeKey;
};

const GiftRibbon = ({
  text, color, className, theme,
}: OwnProps & StateProps) => {
  const randomId = useUniqueId();
  const validSvgRandomId = `svg-${randomId}`; // ID must start with a letter

  const colorKey = COLOR_KEYS.has(color as ColorKey) ? color as ColorKey : undefined;

  const isDarkTheme = theme === 'dark';

  const gradientColor = colorKey ? COLORS[colorKey][isDarkTheme ? 1 : 0] : undefined;
  const startColor = gradientColor ? gradientColor[0] : color;
  const endColor = gradientColor ? gradientColor[1] : color;

  return (
    <div className={buildClassName(styles.root, className)}>
      <svg className={styles.ribbon} width="56" height="56" viewBox="0 0 56 56" fill="none">
        <path d="M52.4851 26.4853L29.5145 3.51472C27.2641 1.26428 24.2119 0 21.0293 0H2.82824C1.04643 0 0.154103 2.15429 1.41403 3.41422L52.5856 54.5858C53.8455 55.8457 55.9998 54.9534 55.9998 53.1716V34.9706C55.9998 31.788 54.7355 28.7357 52.4851 26.4853Z" fill={`url(#${validSvgRandomId})`} />
        <defs>
          <linearGradient id={validSvgRandomId} x1="27.9998" y1="1" x2="27.9998" y2="55" gradientUnits="userSpaceOnUse">
            <stop stop-color={startColor} />
            <stop offset="1" stop-color={endColor} />
          </linearGradient>
        </defs>
      </svg>
      <div className={styles.text}>{text}</div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      theme: selectTheme(global),
    };
  },
)(GiftRibbon));
