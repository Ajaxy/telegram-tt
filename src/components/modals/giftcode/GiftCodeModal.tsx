import React, { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPeer } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { TME_LINK_PREFIX } from '../../../config';
import { selectChatMessage, selectSender } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatDateTimeToString } from '../../../util/dateFormat';
import renderText from '../../common/helpers/renderText';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import LinkField from '../../common/LinkField';
import PickerSelectedItem from '../../common/PickerSelectedItem';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './GiftCodeModal.module.scss';

import PremiumLogo from '../../../assets/premium/PremiumLogo.svg';

export type OwnProps = {
  modal: TabState['giftCodeModal'];
};

export type StateProps = {
  currentUserId?: string;
  messageSender?: ApiPeer;
};

const GIFTCODE_PATH = 'giftcode';

const GiftCodeModal = ({
  currentUserId,
  modal,
  messageSender,
}: OwnProps & StateProps) => {
  const {
    closeGiftCodeModal, openChat, applyGiftCode, focusMessage,
  } = getActions();
  const lang = useLang();
  const isOpen = Boolean(modal);

  const canUse = (!modal?.info.toId || modal?.info.toId === currentUserId) && !modal?.info.usedAt;

  const handleOpenChat = useLastCallback((peerId: string) => {
    openChat({ id: peerId });
    closeGiftCodeModal();
  });

  const handleOpenGiveaway = useLastCallback(() => {
    if (!modal || !modal.info.giveawayMessageId) return;
    focusMessage({
      chatId: modal.info.fromId!,
      messageId: modal.info.giveawayMessageId,
    });
    closeGiftCodeModal();
  });

  const handleButtonClick = useLastCallback(() => {
    if (canUse) {
      applyGiftCode({ slug: modal!.slug });
      return;
    }
    closeGiftCodeModal();
  });

  function renderContent() {
    if (!modal) return undefined;
    const { slug, info } = modal;

    const fromId = info.fromId || messageSender?.id;

    return (
      <>
        <img className={styles.logo} src={PremiumLogo} alt="" draggable={false} />
        <p className={styles.centered}>{renderText(lang('lng_gift_link_about'), ['simple_markdown'])}</p>
        <LinkField title="BoostingGiftLink" link={`${TME_LINK_PREFIX}/${GIFTCODE_PATH}/${slug}`} />
        <table className={styles.table}>
          <tr>
            <td className={styles.title}>{lang('BoostingFrom')}</td>
            <td>
              {fromId ? (
                <PickerSelectedItem
                  peerId={fromId}
                  className={styles.chatItem}
                  forceShowSelf
                  fluid
                  clickArg={fromId}
                  onClick={handleOpenChat}
                />
              ) : lang('BoostingNoRecipient')}
            </td>
          </tr>
          <tr>
            <td className={styles.title}>
              {lang('BoostingTo')}
            </td>
            <td>
              {info.toId ? (
                <PickerSelectedItem
                  peerId={info.toId}
                  className={styles.chatItem}
                  forceShowSelf
                  fluid
                  clickArg={info.toId}
                  onClick={handleOpenChat}
                />
              ) : lang('BoostingNoRecipient')}
            </td>
          </tr>
          <tr>
            <td className={styles.title}>
              {lang('BoostingGift')}
            </td>
            <td>
              {lang('BoostingTelegramPremiumFor', lang('Months', info.months, 'i'))}
            </td>
          </tr>
          <tr>
            <td className={styles.title}>
              {lang('BoostingReason')}
            </td>
            <td className={buildClassName(info.giveawayMessageId && styles.clickable)} onClick={handleOpenGiveaway}>
              {info.isFromGiveaway && !info.toId ? lang('BoostingIncompleteGiveaway')
                : lang(info.isFromGiveaway ? 'BoostingGiveaway' : 'BoostingYouWereSelected')}
            </td>
          </tr>
          <tr>
            <td className={styles.title}>
              {lang('BoostingDate')}
            </td>
            <td>
              {formatDateTimeToString(info.date * 1000, lang.code, true)}
            </td>
          </tr>
        </table>
        <span className={styles.centered}>
          {renderText(
            info.usedAt ? lang('BoostingUsedLinkDate', formatDateTimeToString(info.usedAt * 1000, lang.code, true))
              : lang('BoostingSendLinkToAnyone'),
            ['simple_markdown'],
          )}
        </span>
        <Button onClick={handleButtonClick}>
          {canUse ? lang('BoostingUseLink') : lang('Close')}
        </Button>
      </>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      hasCloseButton
      isSlim
      title={lang('lng_gift_link_title')}
      contentClassName={styles.content}
      onClose={closeGiftCodeModal}
    >
      {renderContent()}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): StateProps => {
    const { message } = modal || {};
    const chatMessage = message && selectChatMessage(global, message.chatId, message.messageId);
    const sender = chatMessage && selectSender(global, chatMessage);

    return {
      currentUserId: global.currentUserId,
      messageSender: sender,
    };
  },
)(GiftCodeModal));
