import React, { memo, useEffect, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiChat, ApiMediaExtendedPreview, ApiMessage, ApiUser,
} from '../../../api/types';
import type { GlobalState, TabState } from '../../../global/types';

import { getChatTitle, getUserFullName } from '../../../global/helpers';
import {
  selectChat, selectChatMessage, selectTabState, selectUser,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../../common/Avatar';
import StarIcon from '../../common/icons/StarIcon';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import BalanceBlock from './BalanceBlock';
import PaidMediaThumb from './PaidMediaThumb';

import styles from './StarsBalanceModal.module.scss';

import StarsBackground from '../../../assets/stars-bg.png';

export type OwnProps = {
  modal: TabState['isStarPaymentModalOpen'];
};

type StateProps = {
  payment?: TabState['payment'];
  starsBalanceState?: GlobalState['stars'];
  bot?: ApiUser;
  paidMediaMessage?: ApiMessage;
  paidMediaChat?: ApiChat;
};

const StarPaymentModal = ({
  modal,
  bot,
  starsBalanceState,
  payment,
  paidMediaMessage,
  paidMediaChat,
}: OwnProps & StateProps) => {
  const { closePaymentModal, openStarsBalanceModal, sendStarPaymentForm } = getActions();
  const [isLoading, markLoading, unmarkLoading] = useFlag();
  const isOpen = Boolean(modal && starsBalanceState);

  const photo = payment?.invoice?.photo;

  const lang = useOldLang();

  useEffect(() => {
    if (!isOpen) {
      unmarkLoading();
    }
  }, [isOpen]);

  const descriptionText = useMemo(() => {
    if (!payment?.invoice) {
      return '';
    }

    const botName = getUserFullName(bot);
    const starsText = lang('Stars.Intro.PurchasedText.Stars', payment.invoice.amount);

    if (paidMediaMessage) {
      const extendedMedia = paidMediaMessage.content.paidMedia!.extendedMedia as ApiMediaExtendedPreview[];
      const areAllPhotos = extendedMedia.every((media) => !media.duration);
      const areAllVideos = extendedMedia.every((media) => !!media.duration);

      const mediaText = areAllPhotos ? lang('Stars.Transfer.Photos', extendedMedia.length)
        : areAllVideos ? lang('Stars.Transfer.Videos', extendedMedia.length)
          : lang('Media', extendedMedia.length);

      const channelTitle = getChatTitle(lang, paidMediaChat!);
      return lang('Stars.Transfer.UnlockInfo', [mediaText, channelTitle, starsText]);
    }

    return lang('Stars.Transfer.Info', [payment.invoice.title, botName, starsText]);
  }, [payment?.invoice, bot, lang, paidMediaMessage, paidMediaChat]);

  const handlePayment = useLastCallback(() => {
    const price = payment?.invoice?.amount;
    const balance = starsBalanceState?.balance;
    if (price === undefined || balance === undefined) {
      return;
    }

    if (price > balance) {
      openStarsBalanceModal({
        originPayment: payment,
      });
      return;
    }

    sendStarPaymentForm();
    markLoading();
  });

  return (
    <Modal
      contentClassName={styles.paymentContent}
      isOpen={isOpen}
      hasAbsoluteCloseButton
      isSlim
      onClose={closePaymentModal}
    >
      <BalanceBlock balance={starsBalanceState?.balance || 0} className={styles.modalBalance} />
      <div className={styles.paymentImages} dir={lang.isRtl ? 'ltr' : 'rtl'}>
        {paidMediaMessage ? (
          <PaidMediaThumb media={paidMediaMessage.content.paidMedia!.extendedMedia} />
        ) : (
          <>
            <Avatar peer={bot} size="giant" />
            {photo && <Avatar className={styles.paymentPhoto} webPhoto={photo} size="giant" />}
          </>
        )}
        <img className={styles.paymentImageBackground} src={StarsBackground} alt="" draggable={false} />
      </div>
      <h2 className={styles.headerText}>
        {lang('StarsConfirmPurchaseTitle')}
      </h2>
      <div className={buildClassName(styles.description, styles.smallerText)}>
        {renderText(descriptionText, ['simple_markdown', 'emoji'])}
      </div>
      <Button className={styles.paymentButton} size="smaller" onClick={handlePayment} isLoading={isLoading}>
        {lang('Stars.Transfer.Pay')}
        <div className={styles.paymentAmount}>
          {payment?.invoice?.amount}
          <StarIcon className={styles.paymentButtonStar} size="small" />
        </div>
      </Button>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const payment = selectTabState(global).payment;
    const bot = payment?.botId ? selectUser(global, payment.botId) : undefined;

    const messageInputInvoice = payment.inputInvoice?.type === 'message' ? payment.inputInvoice : undefined;
    const message = messageInputInvoice
      ? selectChatMessage(global, messageInputInvoice.chatId, messageInputInvoice.messageId) : undefined;
    const chat = messageInputInvoice ? selectChat(global, messageInputInvoice.chatId) : undefined;
    const isPaidMedia = message?.content.paidMedia;

    return {
      bot,
      starsBalanceState: global.stars,
      payment,
      paidMediaMessage: isPaidMedia ? message : undefined,
      paidMediaChat: isPaidMedia ? chat : undefined,
    };
  },
)(StarPaymentModal));
