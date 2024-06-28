import React, { type TeactNode } from '../../../../lib/teact/teact';

import type { ApiKeyboardButton } from '../../../../api/types';

import { replaceWithTeact } from '../../../../util/replaceWithTeact';
import renderText from '../../../common/helpers/renderText';

import { type LangFn } from '../../../../hooks/useOldLang';

import Icon from '../../../common/icons/Icon';

export default function renderKeyboardButtonText(lang: LangFn, button: ApiKeyboardButton): TeactNode {
  if (button.type === 'receipt') {
    return lang('PaymentReceipt');
  }

  if (button.type === 'buy') {
    return replaceWithTeact(button.text, '⭐', <Icon className="star-currency-icon" name="star" />);
  }

  return renderText(button.text);
}
