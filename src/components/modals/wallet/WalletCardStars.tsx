import { memo } from '../../../lib/teact/teact';

import styles from './WalletCard.module.scss';

const CARD_WIDTH = 336;
const TWINKLE_DELAY_STEP = 0.7;

// Center in percent of the card, size in card pixels, resting opacity
const STARS = [
  [89, 13, 16, 0.48], [78, 8, 8, 0.24], [95, 24, 7, 0.2],
  [84, 22, 5, 0.14], [72, 14, 4, 0.1], [11, 76, 15, 0.44],
  [7, 88, 8, 0.22], [21, 86, 6, 0.16], [14, 66, 5, 0.12],
  [92, 62, 12, 0.36], [86, 74, 6, 0.16], [95, 48, 5, 0.12],
  [10, 14, 9, 0.26], [20, 9, 5, 0.12], [7, 28, 4, 0.1],
  [46, 7, 5, 0.12], [60, 10, 4, 0.1], [6, 48, 5, 0.12],
  [78, 91, 7, 0.18], [66, 94, 4, 0.1],
].map(([x, y, size, opacity], index) => {
  const sizeCqi = (size / CARD_WIDTH) * 100;

  return `left:${x}%;top:${y}%;width:${sizeCqi}cqi;height:${sizeCqi}cqi;`
    + `--star-opacity:${opacity};--star-x:${x - 50};--star-y:${50 - y};`
    + `--star-delay:${-index * TWINKLE_DELAY_STEP}s;`;
});

const SPARKLE_PATH = 'M11.65 2.09Q12 1.91 12.35 2.09C12.6 2.22 12.76 2.73 13.1 3.73L14.71 8.56'
  + 'Q14.85 9 15.44 9.29L20.27 10.9Q21.7 11.37 21.91 11.65Q22.09 12 21.91 12.34'
  + 'Q21.7 12.63 20.27 13.09L15.44 14.71Q14.85 14.85 14.71 15.44L13.1 20.27'
  + 'Q12.63 21.7 12.35 21.91Q12 22.09 11.65 21.91Q11.37 21.7 10.9 20.27L9.29 15.44'
  + 'Q9.15 14.85 8.56 14.71L3.73 13.1Q2.3 12.63 2.09 12.35Q1.91 12 2.09 11.65'
  + 'Q2.3 11.37 3.73 10.9L8.56 9.29Q9.15 9.15 9.29 8.56L10.9 3.73Q11.37 2.3 11.65 2.09Z';

const WalletCardStars = () => {
  return (
    <div className={styles.stars} aria-hidden>
      {STARS.map((style) => (
        <span key={style} className={styles.star} style={style}>
          <svg className={styles.sparkle} viewBox="0 0 24 24" fill="currentColor">
            <path d={SPARKLE_PATH} />
          </svg>
        </span>
      ))}
    </div>
  );
};

export default memo(WalletCardStars);
