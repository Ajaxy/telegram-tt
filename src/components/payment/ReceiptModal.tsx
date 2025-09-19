import type { FC } from '../../lib/teact/teact';
import { memo, useEffect, useMemo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiReceiptRegular, ApiShippingAddress } from '../../api/types';

import { selectTabState } from '../../global/selectors';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import usePrevious from '../../hooks/usePrevious';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Checkout from './Checkout';

import './PaymentModal.scss';

export type OwnProps = {
  isOpen?: boolean;
  onClose: () => void;
};

type StateProps = {
  receipt?: ApiReceiptRegular;
};

const ReceiptModal: FC<OwnProps & StateProps> = ({
  isOpen,
  onClose,
  receipt,
}) => {
  const lang = useLang();

  const [isModalOpen, openModal, closeModal] = useFlag();

  useEffect(() => {
    if (isOpen) {
      openModal();
    }
  }, [isOpen, openModal]);

  const prevReceipt = usePrevious(receipt);
  const renderingReceipt = receipt || prevReceipt;

  const checkoutInfo = useMemo(() => {
    if (!renderingReceipt) return undefined;
    return getCheckoutInfo(renderingReceipt.credentialsTitle, renderingReceipt.info, renderingReceipt.shippingMethod);
  }, [renderingReceipt]);

  return (
    <Modal
      className="PaymentModal PaymentModal-receipt"
      isOpen={isModalOpen}
      onClose={closeModal}
      onCloseAnimationEnd={onClose}
    >
      {renderingReceipt && (
        <>
          <div className="header" dir={lang.isRtl ? 'rtl' : undefined}>
            <Button
              className="close-button"
              color="translucent"
              round
              size="smaller"
              onClick={closeModal}
              ariaLabel="Close"
            >
              <Icon name="close" />
            </Button>
            <h3>
              {' '}
              {lang('PaymentReceipt')}
              {' '}
            </h3>
          </div>
          <div className="receipt-content custom-scroll">
            <Checkout
              shippingPrices={renderingReceipt.shippingPrices}
              totalPrice={renderingReceipt.totalAmount}
              tipAmount={renderingReceipt.tipAmount}
              invoice={renderingReceipt.invoice}
              checkoutInfo={checkoutInfo}
              title={renderingReceipt.title}
              description={renderingReceipt.description}
              photo={renderingReceipt.photo}
            />
          </div>
        </>
      )}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { receipt } = selectTabState(global).payment;

    return {
      receipt,
    };
  },
)(ReceiptModal));

function getCheckoutInfo(paymentMethod?: string,
  info?: {
    phone?: string;
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
