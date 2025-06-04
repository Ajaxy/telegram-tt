import type { LangFn } from './types';

import { STARS_ICON_PLACEHOLDER } from '../../config';
import buildClassName from '../buildClassName';

import Icon from '../../components/common/icons/Icon';
import StarIcon from '../../components/common/icons/StarIcon';

export function formatStarsAsText(lang: LangFn, amount: number) {
  return lang('StarsAmountText', { amount }, { pluralValue: amount });
}

export function formatStarsAsIcon(lang: LangFn, amount: number | string, options?: {
  asFont?: boolean; className?: string; containerClassName?: string; }) {
  const { asFont, className, containerClassName } = options || {};
  const icon = asFont
    ? <Icon name="star" className={buildClassName('star-amount-icon', className)} />
    : <StarIcon type="gold" className={buildClassName('star-amount-icon', className)} size="adaptive" />;

  if (containerClassName) {
    return (
      <span className={containerClassName}>
        {lang('StarsAmount', { amount }, {
          withNodes: true,
          specialReplacement: {
            [STARS_ICON_PLACEHOLDER]: icon,
          },
        })}
      </span>
    );
  }

  return lang('StarsAmount', { amount }, {
    withNodes: true,
    specialReplacement: {
      [STARS_ICON_PLACEHOLDER]: icon,
    },
  });
}
