import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiInvoice,
  ApiPeer,
  ApiReceipt, ApiReceiptRegular, ApiShippingAddress,
  ApiStarsTransactionPeer,
} from '../../api/types';
import { MediaViewerOrigin } from '../../types';

import { getMessageLink } from '../../global/helpers';
import { buildStarsTransactionCustomPeer, formatStarsTransactionAmount } from '../../global/helpers/payments';
import { selectPeer, selectTabState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { copyTextToClipboard } from '../../util/clipboard';
import { formatDateTimeToString } from '../../util/dates/dateFormat';

import useFlag from '../../hooks/useFlag';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Icon from '../common/icons/Icon';
import StarIcon from '../common/icons/StarIcon';
import SafeLink from '../common/SafeLink';
import TableInfoModal, { type TableData } from '../modals/common/TableInfoModal';
import PaidMediaThumb from '../modals/stars/PaidMediaThumb';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Checkout from './Checkout';

import './PaymentModal.scss';
import styles from './ReceiptModal.module.scss';

import StarsBackground from '../../assets/stars-bg.png';

export type OwnProps = {
  isOpen?: boolean;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  receipt?: ApiReceipt;
  peer?: ApiPeer;
};

const ReceiptModal: FC<OwnProps & StateProps> = ({
  isOpen, receipt, peer, onClose,
}) => {
  const { showNotification, openMediaViewer } = getActions();
  const lang = useOldLang();

  const handleOpenMedia = useLastCallback(() => {
    const media = receipt?.type === 'stars' && receipt.media;
    if (!media) return;

    openMediaViewer({
      origin: MediaViewerOrigin.StarsTransaction,
      standaloneMedia: media.flatMap((item) => Object.values(item)),
    });
  });

  const starModalData = useMemo(() => {
    if (receipt?.type !== 'stars') return undefined;

    const customPeer = (receipt.peer && receipt.peer.type !== 'peer' && buildStarsTransactionCustomPeer(receipt.peer))
      || undefined;

    const botId = receipt.botId || (receipt.peer?.type === 'peer' ? receipt.peer.id : undefined);
    const toName = receipt.peer && lang(getStarsPeerTitleKey(receipt.peer));

    const title = receipt.title || (customPeer ? lang(customPeer.titleKey) : undefined);

    const messageLink = peer && receipt.messageId ? getMessageLink(peer, undefined, receipt.messageId) : undefined;

    const media = receipt.media;

    const mediaAmount = media?.length || 0;
    const areAllPhotos = media?.every((m) => !m.video);
    const areAllVideos = media?.every((m) => !m.photo);

    const mediaText = areAllPhotos ? lang('Stars.Transfer.Photos', mediaAmount)
      : areAllVideos ? lang('Stars.Transfer.Videos', mediaAmount)
        : lang('Media', mediaAmount);

    const description = receipt.text || (media ? mediaText : undefined);

    const header = (
      <div className={styles.header}>
        {media && (
          <PaidMediaThumb
            className={buildClassName(styles.mediaPreview, 'transaction-media-preview')}
            media={media}
            onClick={handleOpenMedia}
          />
        )}
        <img
          className={buildClassName(styles.starsBackground, receipt.media && styles.mediaShift)}
          src={StarsBackground}
          alt=""
          draggable={false}
        />
        {title && <h1 className={styles.title}>{title}</h1>}
        <p className={styles.description}>{description}</p>
        <p className={styles.amount}>
          <span className={buildClassName(styles.amount, receipt.totalAmount < 0 ? styles.negative : styles.positive)}>
            {formatStarsTransactionAmount(receipt.totalAmount)}
          </span>
          <StarIcon type="gold" size="big" />
        </p>
      </div>
    );

    const tableData: TableData = [];

    tableData.push([
      lang(receipt.totalAmount < 0 ? 'Stars.Transaction.To' : 'Stars.Transaction.Via'),
      botId ? { chatId: botId } : toName || '',
    ]);

    if (messageLink) {
      tableData.push([lang('Stars.Transaction.Media'), <SafeLink url={messageLink} text={messageLink} />]);
    }

    tableData.push([
      lang('Stars.Transaction.Id'),
      (
        <span
          className={styles.tid}
          onClick={() => {
            copyTextToClipboard(receipt.transactionId);
            showNotification({
              message: lang('StarsTransactionIDCopied'),
            });
          }}
        >
          {receipt.transactionId}
          <Icon className={styles.copyIcon} name="copy" />
        </span>
      ),
    ]);

    tableData.push([
      lang('Stars.Transaction.Date'),
      formatDateTimeToString(receipt.date * 1000, lang.code, true),
    ]);

    const footerText = lang('lng_credits_box_out_about');
    const footerTextParts = footerText.split('{link}');

    const footer = (
      <span className={styles.footer}>
        {footerTextParts[0]}
        <SafeLink url={lang('StarsTOSLink')} text={lang('lng_credits_summary_options_about_link')} />
        {footerTextParts[1]}
      </span>
    );

    return {
      header,
      tableData,
      footer,
      avatarPeer: !receipt.photo ? (peer || customPeer) : undefined,
    };
  }, [lang, receipt, peer]);

  if (receipt?.type === 'regular') {
    return <ReceiptModalRegular isOpen={isOpen} receipt={receipt} onClose={onClose} />;
  }

  return (
    <TableInfoModal
      isOpen={isOpen}
      className={styles.modal}
      header={starModalData?.header}
      tableData={starModalData?.tableData}
      footer={starModalData?.footer}
      noHeaderImage={Boolean(receipt?.media)}
      headerAvatarWebPhoto={receipt?.photo}
      headerAvatarPeer={starModalData?.avatarPeer}
      buttonText={lang('OK')}
      onClose={onClose}
    />
  );
};

function ReceiptModalRegular({
  isOpen, receipt, onClose,
}: {
  isOpen?: boolean;
  receipt: ApiReceiptRegular;
  onClose: NoneToVoidFunction;
}) {
  const {
    credentialsTitle,
    currency,
    prices,
    tipAmount,
    totalAmount,
    info,
    photo,
    shippingMethod,
    shippingPrices,
    text,
    title,
  } = receipt;
  const lang = useOldLang();

  const [isModalOpen, openModal, closeModal] = useFlag();

  useEffect(() => {
    if (isOpen) {
      openModal();
    }
  }, [isOpen, openModal]);

  const checkoutInfo = useMemo(() => {
    return getCheckoutInfo(credentialsTitle, info, shippingMethod);
  }, [info, shippingMethod, credentialsTitle]);

  const invoice: ApiInvoice = useMemo(() => {
    return {
      mediaType: 'invoice',
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
            <i className="icon icon-close" />
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
}

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { receipt } = selectTabState(global).payment;

    const peerId = receipt?.type === 'stars' && (receipt.botId || (receipt.peer?.type === 'peer' && receipt.peer.id));
    const peer = peerId ? selectPeer(global, peerId) : undefined;

    return {
      receipt,
      peer,
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

function getStarsPeerTitleKey(peer: ApiStarsTransactionPeer) {
  switch (peer.type) {
    case 'appStore':
      return 'AppStore';
    case 'playMarket':
      return 'PlayMarket';
    case 'fragment':
      return 'Fragment';
    case 'premiumBot':
      return 'StarsTransactionBot';
    case 'ads':
      return 'StarsTransactionAds';
    default:
      return 'Stars.Transaction.Unsupported.Title';
  }
}
