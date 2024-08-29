import type { FC } from '../../../lib/teact/teact';
import React, { memo, useEffect, useMemo } from '../../../lib/teact/teact';

import type { ApiStarTopupOption } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { formatCurrency } from '../../../util/formatCurrency';
import { formatInteger } from '../../../util/textFormat';

import useFlag from '../../../hooks/useFlag';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
import StarIcon from '../../common/icons/StarIcon';
import Button from '../../ui/Button';

import styles from './StarTopupOptionList.module.scss';

const MAX_STARS_COUNT = 6;

type OwnProps = {
  isActive?: boolean;
  options?: ApiStarTopupOption[];
  starsNeeded?: number;
  onClick: (option: ApiStarTopupOption) => void;
};

const StarTopupOptionList: FC<OwnProps> = ({
  isActive,
  options,
  starsNeeded,
  onClick,
}) => {
  const lang = useOldLang();

  const [areOptionsExtended, markOptionsExtended, unmarkOptionsExtended] = useFlag();

  useEffect(() => {
    if (!isActive) {
      unmarkOptionsExtended();
    }
  }, [isActive]);

  const [renderingOptions, canExtend] = useMemo(() => {
    if (!options) {
      return [undefined, false];
    }

    const maxOption = options.reduce((max, option) => (
      max.stars > option.stars ? max : option
    ));
    const forceShowAll = starsNeeded && maxOption.stars < starsNeeded;

    const result: { option: ApiStarTopupOption; starsCount: number; isWide: boolean }[] = [];
    let currentStackedStarsCount = 0;
    let canExtendOptions = false;
    options.forEach((option, index) => {
      if (!option.isExtended) currentStackedStarsCount++;

      if (starsNeeded && !forceShowAll && option.stars < starsNeeded) return;
      if (!areOptionsExtended && option.isExtended) {
        canExtendOptions = true;
        return;
      }
      result.push({
        option,
        starsCount: Math.min(currentStackedStarsCount, MAX_STARS_COUNT),
        isWide: index === options.length - 1,
      });
    });

    return [result, canExtendOptions];
  }, [areOptionsExtended, options, starsNeeded]);

  return (
    <div className={styles.options}>
      {renderingOptions?.map(({ option, starsCount, isWide }) => {
        const length = renderingOptions?.length;
        const isOdd = length % 2 === 0;
        return (
          <div
            className={buildClassName(styles.option, (!isOdd && isWide) && styles.wideOption)}
            key={option.stars}
            onClick={() => onClick?.(option)}
          >
            <div className={styles.optionTop}>
              +{formatInteger(option.stars)}
              <div className={styles.stackedStars} dir={lang.isRtl ? 'ltr' : 'rtl'}>
                {Array.from({ length: starsCount }).map(() => (
                  <StarIcon className={styles.stackedStar} type="gold" size="big" />
                ))}
              </div>
            </div>
            <div className={styles.optionBottom}>
              {formatCurrency(option.amount, option.currency, lang.code)}
            </div>
          </div>
        );
      })}
      {!areOptionsExtended && canExtend && (
        <Button className={styles.moreOptions} isText noForcedUpperCase onClick={markOptionsExtended}>
          {lang('Stars.Purchase.ShowMore')}
          <Icon className={styles.iconDown} name="down" />
        </Button>
      )}
    </div>
  );
};

export default memo(StarTopupOptionList);
