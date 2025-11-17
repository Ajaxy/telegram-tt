import { type TeactNode } from '../../../../lib/teact/teact';

import type { ApiKeyboardButton } from '../../../../api/types';
import type { LangFn } from '../../../../util/localization';

import { STARS_ICON_PLACEHOLDER } from '../../../../config';
import { replaceWithTeact } from '../../../../util/replaceWithTeact';
import renderText from '../../../common/helpers/renderText';

import Icon from '../../../common/icons/Icon';

export default function renderKeyboardButtonText(lang: LangFn, button: ApiKeyboardButton): TeactNode {
  if (button.type === 'receipt') {
    return lang('PaymentReceipt');
  }

  if (button.type === 'buy') {
    return replaceWithTeact(button.text, STARS_ICON_PLACEHOLDER, <Icon className="star-currency-icon" name="star" />);
  }

  return renderText(button.text);
}
