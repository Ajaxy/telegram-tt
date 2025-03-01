import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo,
} from '../../../lib/teact/teact';

import type { ApiStarGiveawayOption, ApiStarTopupOption } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { formatCurrency } from '../../../util/formatCurrency';
import { formatInteger } from '../../../util/textFormat';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
import StarIcon from '../../common/icons/StarIcon';
import Button from '../../ui/Button';

import styles from './StarTopupOptionList.module.scss';

const MAX_STARS_COUNT = 6;

type OwnProps = {
  isActive?: boolean;
  options?: ApiStarTopupOption[] | ApiStarGiveawayOption[];
  selectedStarOption?: ApiStarTopupOption | ApiStarGiveawayOption;
  selectedStarCount?: number;
  starsNeeded?: number;
  className?: string;
  onClick: (option: ApiStarTopupOption | ApiStarGiveawayOption) => void;
};

const StarTopupOptionList: FC<OwnProps> = ({
  isActive,
  className,
  options,
  selectedStarOption,
  selectedStarCount,
  starsNeeded,
  onClick,
}) => {
  const oldLang = useOldLang();
  const lang = useLang();

  const [areOptionsExtended, markOptionsExtended, unmarkOptionsExtended] = useFlag();

  useEffect(() => {
    if (!isActive) {
      unmarkOptionsExtended();
    }
  }, [isActive]);

  const [renderingOptions, canExtend] = useMemo(() => {
    if (!options) return [undefined, false];

    const maxOption = options.reduce((max, option) => (
      max.stars > option.stars ? max : option
    ));
    const forceShowAll = starsNeeded && maxOption.stars < starsNeeded;

    const result: { option: ApiStarTopupOption | ApiStarGiveawayOption; starsCount: number; isWide: boolean }[] = [];
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
    <div className={buildClassName(styles.options, className)}>
      {renderingOptions?.map(({ option, starsCount, isWide }) => {
        const length = renderingOptions?.length;
        const isOdd = length % 2 === 0;
        const isActiveOption = option === selectedStarOption;

        let perUserStarCount;
        if (option && 'winners' in option) {
          const winner = option.winners.find((opt) => opt.users === selectedStarCount)
            || option.winners.reduce((max, opt) => (opt.users > max.users ? opt : max), option.winners[0]);
          perUserStarCount = winner?.perUserStars;
        }

        return (
          <div
            className={buildClassName(
              styles.option, (!isOdd && isWide) && styles.wideOption, isActiveOption && styles.active,
            )}
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
              {formatCurrency(lang, option.amount, option.currency)}
            </div>
            {(isActiveOption || (selectedStarOption && 'winners' in selectedStarOption)) && perUserStarCount && (
              <div className={styles.optionBottom}>
                <div className={styles.perUserStars}>
                  {renderText(oldLang('BoostGift.Stars.PerUser', formatInteger(perUserStarCount)))}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {!areOptionsExtended && canExtend && (
        <Button className={styles.moreOptions} isText noForcedUpperCase onClick={markOptionsExtended}>
          {oldLang('Stars.Purchase.ShowMore')}
          <Icon className={styles.iconDown} name="down" />
        </Button>
      )}
    </div>
  );
};

export default memo(StarTopupOptionList);
