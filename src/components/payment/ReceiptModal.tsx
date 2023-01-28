import React, { memo, useMemo, useEffect } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { FC } from '../../lib/teact/teact';

import type { Price } from '../../types';
import type { ApiShippingAddress, ApiWebDocument } from '../../api/types';

import { selectTabState } from '../../global/selectors';
import useLang from '../../hooks/useLang';
import useFlag from '../../hooks/useFlag';

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
  tipAmount?: number;
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
  tipAmount,
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

  const [isModalOpen, openModal, closeModal] = useFlag();

  useEffect(() => {
    if (isOpen) {
      openModal();
    }
  }, [isOpen, openModal]);

  const checkoutInfo = useMemo(() => {
    return getCheckoutInfo(credentialsTitle, info, shippingMethod);
  }, [info, shippingMethod, credentialsTitle]);

  const invoice = useMemo(() => {
    return {
      photo,
      text: text!,
      title: title!,
      amount: totalAmount!,
      currency: currency!,
    };
  }, [currency, photo, text, title, totalAmount]);

  return (
    <Modal
      className="PaymentModal PaymentModal-receipt"
      isOpen={isModalOpen}
      onClose={closeModal}
      onCloseAnimationEnd={onClose}
    >
      <div>
        <div className="header" dir={lang.isRtl ? 'rtl' : undefined}>
          <Button
            className="close-button"
            color="translucent"
            round
            size="smaller"
            onClick={closeModal}
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
            tipAmount={tipAmount}
            invoice={invoice}
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
    const { receipt } = selectTabState(global).payment;
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
      tipAmount,
    } = (receipt || {});

    return {
      currency,
      prices,
      info,
      tipAmount,
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
