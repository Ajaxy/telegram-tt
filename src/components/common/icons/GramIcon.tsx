import { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import styles from './GramIcon.module.scss';

import GramAppLogo from '../../../assets/icons/gram/gram.png';
import GramLogo from '../../../assets/icons/gram/gram.svg';

type OwnProps = {
  className?: string;
  style?: string;
  isAppIcon?: boolean;
  isMono?: boolean;
  onClick?: VoidFunction;
};

/* eslint-disable @stylistic/max-len */
// Gem combined with the inner star; `evenodd` punches the star out so the shape can be tinted via `currentColor`
const LOGO_PATH = 'M51.09 0H25.71c-3.38 0-5.07 0-6.598.473a10.6 10.6 0 0 0-3.693 2.015c-1.224 1.03-2.138 2.452-3.966 5.296l-8.067 12.55C2.178 22.211 1.574 23.15 1.41 24.14a4.86 4.86 0 0 0 .278 2.587c.37.931 1.16 1.721 2.74 3.3l29.977 29.978c1.398 1.398 2.098 2.098 2.904 2.36.709.23 1.473.23 2.182 0 .806-.262 1.505-.962 2.904-2.36l29.978-29.978c1.579-1.579 2.368-2.369 2.739-3.3a4.86 4.86 0 0 0 .278-2.587c-.164-.989-.768-1.928-1.976-3.807l-8.067-12.55C63.519 4.94 62.605 3.52 61.38 2.489A10.6 10.6 0 0 0 57.688.473C56.16 0 54.47 0 51.09 0 M46.286 9.9c.412-1.114 1.988-1.114 2.4 0l2.85 7.7c.171.463.536.828.998 1l7.701 2.849c1.114.412 1.114 1.988 0 2.4l-7.7 2.85a1.7 1.7 0 0 0-.999.998l-2.85 7.7c-.412 1.115-1.988 1.115-2.4 0l-2.85-7.7a1.7 1.7 0 0 0-.998-.998l-7.7-2.85c-1.115-.412-1.115-1.988 0-2.4l7.7-2.85a1.7 1.7 0 0 0 .998-.998z';
/* eslint-enable @stylistic/max-len */

const GramIcon = ({
  className, style, isAppIcon, isMono, onClick,
}: OwnProps) => {
  if (isMono) {
    return (
      <svg
        viewBox="0 0 76 64"
        className={buildClassName(styles.root, className)}
        style={style}
        onClick={onClick}
      >
        <path fill="currentColor" fill-rule="evenodd" d={LOGO_PATH} />
      </svg>
    );
  }

  return (
    <img
      src={isAppIcon ? GramAppLogo : GramLogo}
      alt=""
      draggable={false}
      className={buildClassName(styles.root, isAppIcon && styles.appIcon, className)}
      style={style}
      onClick={onClick}
    />
  );
};

export default memo(GramIcon);
