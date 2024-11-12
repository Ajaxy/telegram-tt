import React, { memo, useEffect, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiChat, ApiMediaExtendedPreview, ApiMessage, ApiUser,
} from '../../../api/types';
import type { GlobalState, TabState } from '../../../global/types';

import { getChatTitle, getCustomPeerFromInvite, getUserFullName } from '../../../global/helpers';
import {
  selectChat, selectChatMessage, selectUser,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import usePrevious from '../../../hooks/usePrevious';

import Avatar from '../../common/Avatar';
import StarIcon from '../../common/icons/StarIcon';
import SafeLink from '../../common/SafeLink';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import BalanceBlock from './BalanceBlock';
import PaidMediaThumb from './transaction/PaidMediaThumb';

import styles from './StarsBalanceModal.module.scss';

import StarsBackground from '../../../assets/stars-bg.png';

export type OwnProps = {
  modal: TabState['starsPayment'];
};

type StateProps = {
  starsBalanceState?: GlobalState['stars'];
  bot?: ApiUser;
  paidMediaMessage?: ApiMessage;
  paidMediaChat?: ApiChat;
};

const StarPaymentModal = ({
  modal,
  bot,
  starsBalanceState,
  paidMediaMessage,
  paidMediaChat,
}: OwnProps & StateProps) => {
  const { closeStarsPaymentModal, openStarsBalanceModal, sendStarPaymentForm } = getActions();
  const [isLoading, markLoading, unmarkLoading] = useFlag();
  const isOpen = Boolean(modal?.inputInvoice && starsBalanceState);

  const prevModal = usePrevious(modal);
  const renderingModal = modal || prevModal;

  const { form, subscriptionInfo } = renderingModal || {};
  const amount = form?.invoice?.totalAmount || subscriptionInfo?.subscriptionPricing?.amount;

  const photo = form?.photo;

  const oldLang = useOldLang();
  const lang = useLang();

  useEffect(() => {
    if (!isOpen) {
      unmarkLoading();
    }
  }, [isOpen]);

  const descriptionText = useMemo(() => {
    if (!renderingModal?.inputInvoice) {
      return '';
    }

    const botName = getUserFullName(bot);
    const starsText = oldLang('Stars.Intro.PurchasedText.Stars', amount);

    if (paidMediaMessage) {
      const extendedMedia = paidMediaMessage.content.paidMedia!.extendedMedia as ApiMediaExtendedPreview[];
      const areAllPhotos = extendedMedia.every((media) => !media.duration);
      const areAllVideos = extendedMedia.every((media) => !!media.duration);

      const mediaText = areAllPhotos ? oldLang('Stars.Transfer.Photos', extendedMedia.length)
        : areAllVideos ? oldLang('Stars.Transfer.Videos', extendedMedia.length)
          : oldLang('Media', extendedMedia.length);

      const channelTitle = getChatTitle(oldLang, paidMediaChat!);
      return oldLang('Stars.Transfer.UnlockInfo', [mediaText, channelTitle, starsText]);
    }

    if (subscriptionInfo) {
      return lang('StarsSubscribeText', {
        chat: subscriptionInfo.title,
        amount,
      }, {
        withNodes: true,
        withMarkdown: true,
        pluralValue: amount!,
      });
    }

    return oldLang('Stars.Transfer.Info', [form!.title, botName, starsText]);
  }, [renderingModal, bot, oldLang, amount, paidMediaMessage, subscriptionInfo, form, paidMediaChat, lang]);

  const disclaimerText = useMemo(() => {
    if (subscriptionInfo) {
      return lang('StarsSubscribeInfo', {
        link: <SafeLink url={lang('StarsSubscribeInfoLink')} text={lang('StarsSubscribeInfoLinkText')} />,
      }, {
        withNodes: true,
      });
    }

    return undefined;
  }, [subscriptionInfo, lang]);

  const inviteCustomPeer = useMemo(() => {
    if (!subscriptionInfo) {
      return undefined;
    }

    return getCustomPeerFromInvite(subscriptionInfo);
  }, [subscriptionInfo]);

  const handlePayment = useLastCallback(() => {
    const balance = starsBalanceState?.balance;
    if (amount === undefined || balance === undefined) {
      return;
    }

    if (amount > balance) {
      openStarsBalanceModal({
        originStarsPayment: modal,
      });
      return;
    }

    sendStarPaymentForm({});
    markLoading();
  });

  return (
    <Modal
      contentClassName={styles.paymentContent}
      isOpen={isOpen}
      hasAbsoluteCloseButton
      isSlim
      onClose={closeStarsPaymentModal}
    >
      <BalanceBlock balance={starsBalanceState?.balance} className={styles.modalBalance} />
      <div className={styles.paymentImages} dir={oldLang.isRtl ? 'ltr' : 'rtl'}>
        {paidMediaMessage ? (
          <PaidMediaThumb media={paidMediaMessage.content.paidMedia!.extendedMedia} />
        ) : inviteCustomPeer ? (
          <>
            <Avatar className={styles.paymentPhoto} peer={inviteCustomPeer} size="giant" />
            <StarIcon type="gold" size="adaptive" className={styles.avatarStar} />
          </>
        ) : (
          <>
            <Avatar peer={bot} size="giant" />
            {photo && <Avatar className={styles.paymentPhoto} webPhoto={photo} size="giant" />}
          </>
        )}
        <img className={styles.paymentImageBackground} src={StarsBackground} alt="" draggable={false} />
      </div>
      <h2 className={styles.headerText}>
        {inviteCustomPeer ? oldLang('StarsSubscribeTitle') : oldLang('StarsConfirmPurchaseTitle')}
      </h2>
      <div className={styles.description}>
        {renderText(descriptionText, ['simple_markdown', 'emoji'])}
      </div>
      <Button className={styles.paymentButton} size="smaller" onClick={handlePayment} isLoading={isLoading}>
        {oldLang('Stars.Transfer.Pay')}
        <div className={styles.paymentAmount}>
          {amount}
          <StarIcon className={styles.paymentButtonStar} size="small" />
        </div>
      </Button>
      {disclaimerText && (
        <div className={buildClassName(styles.disclaimer, styles.smallerText)}>
          {disclaimerText}
        </div>
      )}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): StateProps => {
    const bot = modal?.form?.botId ? selectUser(global, modal.form.botId) : undefined;

    const messageInputInvoice = modal?.inputInvoice?.type === 'message' ? modal.inputInvoice : undefined;
    const message = messageInputInvoice
      ? selectChatMessage(global, messageInputInvoice.chatId, messageInputInvoice.messageId) : undefined;
    const chat = messageInputInvoice ? selectChat(global, messageInputInvoice.chatId) : undefined;
    const isPaidMedia = message?.content.paidMedia;

    return {
      bot,
      starsBalanceState: global.stars,
      paidMediaMessage: isPaidMedia ? message : undefined,
      paidMediaChat: isPaidMedia ? chat : undefined,
    };
  },
)(StarPaymentModal));
