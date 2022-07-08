import type { FC } from '../../lib/teact/teact';
import React, { memo, useMemo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { Price } from '../../types';
import type { ApiShippingAddress, ApiWebDocument } from '../../api/types';

import useLang from '../../hooks/useLang';

import Checkout from './Checkout';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

import './PaymentModal.scss';

export type OwnProps = {
  isOpen?: boolean;
  onClose: () => void;
};

type StateProps = {
  prices?: Price[];
  shippingPrices: any;
  totalAmount?: number;
  currency?: string;
  info?: {
    shippingAddress?: ApiShippingAddress;
    phone?: string;
    name?: string;
  };
  photo?: ApiWebDocument;
  text?: string;
  title?: string;
  credentialsTitle?: string;
  shippingMethod?: string;
};

const ReceiptModal: FC<OwnProps & StateProps> = ({
  isOpen,
  onClose,
  prices,
  shippingPrices,
  totalAmount,
  currency,
  info,
  photo,
  text,
  title,
  credentialsTitle,
  shippingMethod,
}) => {
  const lang = useLang();
  const checkoutInfo = useMemo(() => {
    return getCheckoutInfo(credentialsTitle, info, shippingMethod);
  }, [info, shippingMethod, credentialsTitle]);

  return (
    <Modal
      className="PaymentModal PaymentModal-receipt"
      isOpen={isOpen}
      onClose={onClose}
    >
      <div>
        <div className="header" dir={lang.isRtl ? 'rtl' : undefined}>
          <Button
            className="close-button"
            color="translucent"
            round
            size="smaller"
            onClick={onClose}
            ariaLabel="Close"
          >
            <i className="icon-close" />
          </Button>
          <h3> {lang('PaymentReceipt')} </h3>
        </div>
        <div className="receipt-content custom-scroll">
          <Checkout
            prices={prices}
            shippingPrices={shippingPrices}
            totalPrice={totalAmount}
            invoiceContent={{
              photo,
              text,
              title,
            }}
            checkoutInfo={checkoutInfo}
            currency={currency!}
          />
        </div>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { receipt } = global.payment;
    const {
      currency,
      prices,
      info,
      totalAmount,
      credentialsTitle,
      shippingPrices,
      shippingMethod,
      photo,
      text,
      title,
    } = (receipt || {});

    return {
      currency,
      prices,
      info,
      totalAmount,
      credentialsTitle,
      shippingPrices,
      shippingMethod,
      photo,
      text,
      title,
    };
  },
)(ReceiptModal));

function getCheckoutInfo(paymentMethod?: string,
  info?:
  { phone?: string;
    name?: string;
    shippingAddress?: ApiShippingAddress;
  },
  shippingMethod?: string) {
  if (!info) {
    return { paymentMethod };
  }
  const { shippingAddress } = info;
  const fullAddress = shippingAddress?.streetLine1
    ? `${shippingAddress.streetLine1}, ${shippingAddress.city}, ${shippingAddress.countryIso2}`
    : undefined;
  const { phone, name } = info;
  return {
    paymentMethod,
    shippingAddress: fullAddress,
    name,
    phone,
    shippingMethod,
  };
}
