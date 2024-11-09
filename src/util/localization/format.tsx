import React from '../../lib/teact/teact';

import type { LangFn } from './types';

import { STARS_ICON_PLACEHOLDER } from '../../config';

import StarIcon from '../../components/common/icons/StarIcon';

export function formatStarsAsText(lang: LangFn, amount: number) {
  return lang('StarsAmountText', { amount }, { pluralValue: amount });
}

export function formatStarsAsIcon(lang: LangFn, amount: number) {
  return lang('StarsAmount', { amount }, {
    withNodes: true,
    specialReplacement: {
      [STARS_ICON_PLACEHOLDER]: <StarIcon type="gold" className="star-amount-icon" size="adaptive" />,
    },
  });
}
