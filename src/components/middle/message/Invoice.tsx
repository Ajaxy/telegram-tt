import React, { FC, memo } from '../../../lib/teact/teact';

import { ApiMessage } from '../../../api/types';

import { getMessageInvoice } from '../../../modules/helpers';
import { formatCurrency } from '../../../util/formatCurrency';
import renderText from '../../common/helpers/renderText';
import useLang from '../../../hooks/useLang';

import './Invoice.scss';

type OwnProps = {
  message: ApiMessage;
};

const Invoice: FC<OwnProps> = ({
  message,
}) => {
  const lang = useLang();
  const invoice = getMessageInvoice(message);

  const {
    title,
    text,
    amount,
    currency,
    isTest,
    photoUrl,
  } = invoice!;

  return (
    <div
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
