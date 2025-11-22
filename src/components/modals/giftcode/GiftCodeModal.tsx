import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPeer } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { TME_LINK_PREFIX } from '../../../config';
import { selectChatMessage, selectSender } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatCountdownDays, formatDateTimeToString } from '../../../util/dates/dateFormat';
import renderText from '../../common/helpers/renderText';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import LinkField from '../../common/LinkField';
import TableInfoModal, { type TableData } from '../common/TableInfoModal';

import styles from './GiftCodeModal.module.scss';

import PremiumLogo from '../../../assets/premium/PremiumStar.svg';

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
    closeGiftCodeModal, applyGiftCode, focusMessage,
  } = getActions();
  const lang = useLang();
  const oldLang = useOldLang();
  const isOpen = Boolean(modal);

  const canUse = (!modal?.info.toId || modal?.info.toId === currentUserId) && !modal?.info.usedAt;

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

  const modalData = useMemo(() => {
    if (!modal) return undefined;
    const { slug, info } = modal;

    const fromId = info.fromId || messageSender?.id;

    const header = (
      <>
        <img src={PremiumLogo} alt="" className={styles.logo} />
        <p className={styles.centered}>{renderText(oldLang('lng_gift_link_about'), ['simple_markdown'])}</p>
        <LinkField title="BoostingGiftLink" link={`${TME_LINK_PREFIX}/${GIFTCODE_PATH}/${slug}`} />
      </>
    );

    const tableData: TableData = [
      [oldLang('BoostingFrom'), fromId ? { chatId: fromId } : oldLang('BoostingNoRecipient')],
      [oldLang('BoostingTo'), info.toId ? { chatId: info.toId } : oldLang('BoostingNoRecipient')],
      [oldLang('BoostingGift'), oldLang('BoostingTelegramPremiumFor', formatCountdownDays(lang, info.days))],
    ];
    if (info.isFromGiveaway) {
      tableData.push([
        oldLang('BoostingReason'),
        (
          <span
            className={buildClassName(info.giveawayMessageId && styles.clickable)}
            onClick={handleOpenGiveaway}
          >
            {info.isFromGiveaway && !info.toId
              ? oldLang('BoostingIncompleteGiveaway')
              : oldLang('BoostingGiveaway')}
          </span>
        ),
      ]);
    }
    tableData.push([
      oldLang('BoostingDate'),
      formatDateTimeToString(info.date * 1000, oldLang.code, true),
    ]);

    const footer = (
      <span className={styles.centered}>
        {renderText(
          info.usedAt ? oldLang('BoostingUsedLinkDate', formatDateTimeToString(info.usedAt * 1000, oldLang.code, true))
            : oldLang('BoostingSendLinkToAnyone'),
          ['simple_markdown'],
        )}
      </span>
    );

    return {
      header,
      tableData,
      footer,
    };
  }, [lang, oldLang, messageSender?.id, modal]);

  if (!modalData) return undefined;

  return (
    <TableInfoModal
      isOpen={isOpen}
      title={oldLang('lng_gift_link_title')}
      tableData={modalData.tableData}
      header={modalData.header}
      footer={modalData.footer}
      buttonText={canUse ? oldLang('BoostingUseLink') : oldLang('Close')}
      onButtonClick={handleButtonClick}
      onClose={closeGiftCodeModal}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const { message } = modal || {};
    const chatMessage = message && selectChatMessage(global, message.chatId, message.messageId);
    const sender = chatMessage && selectSender(global, chatMessage);

    return {
      currentUserId: global.currentUserId,
      messageSender: sender,
    };
  },
)(GiftCodeModal));
