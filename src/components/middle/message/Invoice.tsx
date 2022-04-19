import React, {
  FC, memo, useLayoutEffect, useRef,
} from '../../../lib/teact/teact';

import { ApiMessage } from '../../../api/types';
import { ISettings } from '../../../types';

import { CUSTOM_APPENDIX_ATTRIBUTE } from '../../../config';
import { getMessageInvoice } from '../../../global/helpers';
import { formatCurrency } from '../../../util/formatCurrency';
import renderText from '../../common/helpers/renderText';
import getCustomAppendixBg from './helpers/getCustomAppendixBg';
import useLang from '../../../hooks/useLang';

import './Invoice.scss';

type OwnProps = {
  message: ApiMessage;
  shouldAffectAppendix?: boolean;
  isInSelectMode?: boolean;
  isSelected?: boolean;
  theme: ISettings['theme'];
};

const Invoice: FC<OwnProps> = ({
  message,
  shouldAffectAppendix,
  isInSelectMode,
  isSelected,
  theme,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const lang = useLang();
  const invoice = getMessageInvoice(message);

  const {
    title,
    text,
    amount,
    currency,
    isTest,
    photoUrl,
    photoWidth,
    photoHeight,
  } = invoice!;

  useLayoutEffect(() => {
    if (!shouldAffectAppendix) {
      return;
    }

    const contentEl = ref.current!.closest<HTMLDivElement>('.message-content')!;

    if (photoUrl) {
      getCustomAppendixBg(photoUrl, false, isInSelectMode, isSelected, theme).then((appendixBg) => {
        contentEl.style.setProperty('--appendix-bg', appendixBg);
        contentEl.setAttribute(CUSTOM_APPENDIX_ATTRIBUTE, '');
      });
    }
  }, [shouldAffectAppendix, photoUrl, isInSelectMode, isSelected, theme]);

  const photoStyle = photoHeight && photoWidth ? `aspect-ratio: ${photoWidth / photoHeight};` : undefined;

  return (
    <div
      ref={ref}
      className="Invoice"
    >
      {title && (
        <p className="title">{renderText(title)}</p>
      )}
      {text && (
        <p>{renderText(text, ['emoji', 'br'])}</p>
      )}
      <div className={`description ${photoUrl ? 'has-image' : ''}`}>
        {photoUrl && (
          <img
            className="invoice-image"
            src={photoUrl}
            alt=""
            style={photoStyle}
            crossOrigin="anonymous"
          />
        )}
        <p className="description-text">
          {formatCurrency(amount, currency, lang.code)}
          {isTest && <span>{lang('PaymentTestInvoice')}</span>}
        </p>
      </div>
    </div>
  );
};

export default memo(Invoice);
