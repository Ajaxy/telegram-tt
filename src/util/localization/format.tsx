import React from '../../lib/teact/teact';

import type { LangFn } from './types';

import { STARS_ICON_PLACEHOLDER } from '../../config';

import Icon from '../../components/common/icons/Icon';
import StarIcon from '../../components/common/icons/StarIcon';

export function formatStarsAsText(lang: LangFn, amount: number) {
  return lang('StarsAmountText', { amount }, { pluralValue: amount });
}

export function formatStarsAsIcon(lang: LangFn, amount: number, asFont?: boolean) {
  const icon = asFont
    ? <Icon name="star" className="star-amount-icon" />
    : <StarIcon type="gold" className="star-amount-icon" size="adaptive" />;
  return lang('StarsAmount', { amount }, {
    withNodes: true,
    specialReplacement: {
      [STARS_ICON_PLACEHOLDER]: icon,
    },
  });
}
