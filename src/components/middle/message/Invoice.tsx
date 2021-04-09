import React, { FC, memo } from '../../../lib/teact/teact';

import { ApiMessage } from '../../../api/types';

import { getMessageInvoice } from '../../../modules/helpers';
import renderText from '../../common/helpers/renderText';

import './Invoice.scss';

type OwnProps = {
  message: ApiMessage;
};

const Invoice: FC<OwnProps> = ({
  message,
}) => {
  const invoice = getMessageInvoice(message);

  const {
    title,
    text,
    description,
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
        {description && (
          <p className="description-text">{renderText(description, ['emoji', 'br'])}</p>
        )}
      </div>
    </div>
  );
};

export default memo(Invoice);
