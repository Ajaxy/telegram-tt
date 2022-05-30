import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import useLang from '../../hooks/useLang';

import './ConfirmPayment.scss';

export type OwnProps = {
  url: string;
};

const ConfirmPayment: FC<OwnProps> = ({ url }) => {
  const lang = useLang();

  return (
    <div className="ConfirmPayment">
      <iframe
        src={url}
        title={lang('Checkout.WebConfirmation.Title')}
        allow="payment"
        sandbox="allow-forms allow-scripts allow-same-origin allow-top-navigation"
        className="ConfirmPayment__content"
      />
    </div>
  );
};

export default memo(ConfirmPayment);
