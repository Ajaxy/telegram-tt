import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import useUniqueId from '../../../hooks/useUniqueId';

import styles from './StarIcon.module.scss';

type OwnProps = {
  type?: 'gold' | 'premium' | 'regular';
  size?: 'small' | 'middle' | 'big' | 'adaptive';
  className?: string;
  onClick?: VoidFunction;
};

/* eslint-disable max-len */
const STAR_PATH = 'M6.63869 12.1902L3.50621 14.1092C3.18049 14.3087 2.75468 14.2064 2.55515 13.8807C2.45769 13.7216 2.42864 13.5299 2.47457 13.3491L2.95948 11.4405C3.13452 10.7515 3.60599 10.1756 4.24682 9.86791L7.6642 8.22716C7.82352 8.15067 7.89067 7.95951 7.81418 7.80019C7.75223 7.67116 7.61214 7.59896 7.47111 7.62338L3.66713 8.28194C2.89387 8.41581 2.1009 8.20228 1.49941 7.69823L0.297703 6.69116C0.00493565 6.44581 -0.0335059 6.00958 0.211842 5.71682C0.33117 5.57442 0.502766 5.48602 0.687982 5.47153L4.35956 5.18419C4.61895 5.16389 4.845 4.99974 4.94458 4.75937L6.36101 1.3402C6.5072 0.987302 6.91179 0.819734 7.26469 0.965925C7.43413 1.03612 7.56876 1.17075 7.63896 1.3402L9.05539 4.75937C9.15496 4.99974 9.38101 5.16389 9.6404 5.18419L13.3322 5.47311C13.713 5.50291 13.9975 5.83578 13.9677 6.2166C13.9534 6.39979 13.8667 6.56975 13.7269 6.68896L10.9114 9.08928C10.7131 9.25826 10.6267 9.52425 10.6876 9.77748L11.5532 13.3733C11.6426 13.7447 11.414 14.1182 11.0427 14.2076C10.8642 14.2506 10.676 14.2208 10.5195 14.1249L7.36128 12.1902C7.13956 12.0544 6.8604 12.0544 6.63869 12.1902Z';
const GOLD_STAR_PATH = 'M10.5197 16.2049L6.46899 18.6864C6.04779 18.9444 5.49716 18.8121 5.23913 18.3909C5.11311 18.1852 5.07554 17.9373 5.13494 17.7035L5.762 15.2354C5.98835 14.3444 6.59803 13.5997 7.42671 13.2018L11.8459 11.0801C12.0519 10.9812 12.1387 10.734 12.0398 10.528C11.9597 10.3611 11.7786 10.2677 11.5962 10.2993L6.67709 11.1509C5.67715 11.324 4.65172 11.0479 3.87392 10.3961L2.31994 9.09382C1.94135 8.77655 1.89164 8.21245 2.20891 7.83386C2.36321 7.64972 2.58511 7.53541 2.82462 7.51667L7.5725 7.1451C7.90793 7.11885 8.20025 6.90658 8.32901 6.59574L10.1607 2.17427C10.3497 1.71792 10.8729 1.50123 11.3292 1.69028C11.5484 1.78105 11.7225 1.95514 11.8132 2.17427L13.6449 6.59574C13.7736 6.90658 14.066 7.11885 14.4014 7.1451L19.1754 7.51871C19.6678 7.55725 20.0358 7.9877 19.9972 8.48015C19.9787 8.71704 19.8666 8.93682 19.6858 9.09098L16.0449 12.1949C15.7886 12.4134 15.6768 12.7574 15.7556 13.0849L16.8749 17.7348C16.9905 18.215 16.6949 18.698 16.2147 18.8137C15.9839 18.8692 15.7406 18.8307 15.5382 18.7068L11.4541 16.2049C11.1674 16.0292 10.8064 16.0292 10.5197 16.2049Z';
/* eslint-enable max-len */

const StarIcon: FC<OwnProps> = ({
  type = 'regular',
  size = 'small',
  className,
  onClick,
}) => {
  const randomId = useUniqueId();
  const validSvgRandomId = `svg-${randomId}`; // ID must start with a letter

  return (
    <i
      onClick={onClick}
      className={buildClassName(
        'StarIcon',
        styles.root,
        className,
        onClick && styles.clickable,
        styles[size],
      )}
    >
      {type === 'gold'
        ? <GoldStarIcon randomId={validSvgRandomId} />
        : type === 'premium'
          ? <PremiumStarIcon randomId={validSvgRandomId} />
          : <RegularStarIcon />}
    </i>
  );
};

function GoldStarIcon({ randomId }: { randomId: string }) {
  const fillId = `${randomId}-fill`;
  const stroke1Id = `${randomId}-stroke1`;
  const stroke2Id = `${randomId}-stroke2`;

  return (
    <svg className={styles.svg} width="21" height="20" viewBox="0 0 21 20" fill="none">
      <defs>
        <linearGradient
          id={fillId}
          x1="0.434893"
          y1="22.5796"
          x2="34.2364"
          y2="-15.5089"
          gradientUnits="userSpaceOnUse"
        >
          <stop stop-color="#FDEB32" />
          <stop offset="0.439058" stop-color="#FEBD04" />
          <stop offset="1" stop-color="#D75902" />
        </linearGradient>
        <linearGradient
          id={stroke1Id}
          x1="22.5"
          y1="2.5"
          x2="8"
          y2="12.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop stop-color="#DB5A00" />
          <stop offset="1" stop-color="#FF9145" />
        </linearGradient>
        <linearGradient
          id={stroke2Id}
          x1="24.5"
          y1="2"
          x2="11"
          y2="10.2302"
          gradientUnits="userSpaceOnUse"
        >
          <stop stop-color="white" stop-opacity="0" />
          <stop offset="0.395833" stop-color="white" stop-opacity="0.85" />
          <stop offset="0.520833" stop-color="white" />
          <stop offset="0.645833" stop-color="white" stop-opacity="0.85" />
          <stop offset="1" stop-color="white" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d={GOLD_STAR_PATH}
        fill={`url(#${fillId})`}
        stroke={`url(#${stroke1Id})`}
      />
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d={GOLD_STAR_PATH}
        stroke={`url(#${stroke2Id})`}
        stroke-width="2"
        style="mix-blend-mode:soft-light"
      />
    </svg>
  );
}

function PremiumStarIcon({ randomId }: { randomId: string }) {
  return (
    <svg className={styles.svg} width="14" height="15" viewBox="0 0 14 15" fill="none">
      <defs>
        <linearGradient id={randomId} x1="3" y1="63.5001" x2="84.1475" y2="-1.32262" gradientUnits="userSpaceOnUse">
          <stop stop-color="#6B93FF" />
          <stop offset="0.439058" stop-color="#976FFF" />
          <stop offset="1" stop-color="#E46ACE" />
        </linearGradient>
      </defs>
      <path fill-rule="evenodd" clip-rule="evenodd" d={STAR_PATH} fill={`url(#${randomId})`} />
    </svg>
  );
}

function RegularStarIcon() {
  return (
    <svg className={styles.svg} width="14" height="15" viewBox="0 0 14 15" fill="none">
      <path fill-rule="evenodd" clip-rule="evenodd" d={STAR_PATH} fill="var(--color-fill)" />
    </svg>
  );
}

export default memo(StarIcon);
