import { memo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiMessage, ApiPeer } from '../../../../api/types';
import type { ApiMessageActionSuggestedPostApproval } from '../../../../api/types/messageActions';

import { TON_CURRENCY_CODE } from '../../../../config';
import { getPeerFullTitle } from '../../../../global/helpers/peers';
import { getMessageReplyInfo } from '../../../../global/helpers/replies';
import { selectIsMonoforumAdmin, selectMonoforumChannel,
  selectReplyMessage,
  selectSender } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { formatScheduledDateTime, formatShortDuration } from '../../../../util/dates/dateFormat';
import { convertTonFromNanos } from '../../../../util/formatCurrency';
import { formatStarsAsText, formatTonAsText } from '../../../../util/localization/format';
import { getServerTime } from '../../../../util/serverTime';
import renderText from '../../../common/helpers/renderText';
import { renderPeerLink, translateWithYou } from '../helpers/messageActions';

import useLang from '../../../../hooks/useLang';
import useOldLang from '../../../../hooks/useOldLang';

import styles from '../ActionMessage.module.scss';

type OwnProps = {
  message: ApiMessage;
  action: ApiMessageActionSuggestedPostApproval;
  onClick?: NoneToVoidFunction;
};

type StateProps = {
  sender?: ApiPeer;
  chat?: ApiPeer;
  originalSender?: ApiPeer;
  ageMinSeconds: number;
  isAdmin: boolean;
};

const SuggestedPostApproval = ({
  message,
  action,
  sender,
  chat,
  originalSender,
  ageMinSeconds,
  isAdmin,
  onClick,
}: OwnProps & StateProps) => {
  const lang = useLang();
  const oldLang = useOldLang();
  const { scheduleDate, amount } = action;

  const chatTitle = chat && getPeerFullTitle(lang, chat);
  const renderChatLink = () => renderPeerLink(chat?.id, chatTitle || lang('ActionFallbackChat'));

  const originalSenderTitle = originalSender && getPeerFullTitle(lang, originalSender);
  const originalSenderLink = renderPeerLink(originalSender?.id, originalSenderTitle || lang('ActionFallbackUser'));

  const publishDate = scheduleDate
    ? formatScheduledDateTime(scheduleDate, lang, oldLang)
    : lang('SuggestMessageAnytime');

  const isPostPublished = scheduleDate ? scheduleDate <= getServerTime() : false;

  const currency = amount?.currency;
  const amountValue = amount?.amount || 0;

  const formattedAmount = amountValue > 0
    ? (currency === TON_CURRENCY_CODE
      ? formatTonAsText(lang, convertTonFromNanos(amountValue))
      : formatStarsAsText(lang, amountValue))
    : undefined;

  const duration = formatShortDuration(lang, ageMinSeconds, true);

  return (
    <div
      className={buildClassName(styles.contentBox, styles.suggestedPostContentBox)}
      onClick={onClick}
    >
      <div className={styles.suggestedPostApprovalTitle}>
        {renderText(lang('SuggestedPostAgreementReached'))}
      </div>

      <div className={styles.suggestedPostApprovalSection}>
        {translateWithYou(
          lang,
          isPostPublished ? 'SuggestedPostPublished' : 'SuggestedPostPublishSchedule',
          !isAdmin,
          { peer: renderChatLink(), date: publishDate },
          { withMarkdown: true },
        )}
      </div>

      {formattedAmount && (
        <div className={styles.suggestedPostApprovalSection}>
          {translateWithYou(lang,
            'SuggestedPostCharged',
            !isAdmin,
            {
              user: originalSenderLink,
              amount: formattedAmount,
            },
            { withMarkdown: true },
          )}
        </div>
      )}

      {isPostPublished && formattedAmount && (
        <>
          <div className={styles.suggestedPostApprovalSection}>
            {translateWithYou(lang, 'SuggestedPostReceiveAmount', !isAdmin, {
              peer: renderChatLink(),
              duration,
            }, { withMarkdown: true })}
          </div>

          <div className={styles.suggestedPostApprovalSection}>
            {translateWithYou(lang, 'SuggestedPostRefund', !isAdmin, {
              peer: renderChatLink(),
              duration,
            }, { withMarkdown: true })}
          </div>
        </>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message }): Complete<StateProps> => {
    const sender = selectSender(global, message);
    const chat = selectMonoforumChannel(global, message.chatId);

    const replyInfo = getMessageReplyInfo(message);
    let originalSender: ApiPeer | undefined;

    if (replyInfo?.type === 'message' && replyInfo.replyToMsgId) {
      const replyMessage = selectReplyMessage(global, message);
      if (replyMessage) {
        originalSender = selectSender(global, replyMessage);
      }
    }

    const { appConfig } = global;
    const ageMinSeconds = appConfig.starsSuggestedPostAgeMin;
    const isAdmin = chat ? Boolean(selectIsMonoforumAdmin(global, message.chatId)) : false;

    return {
      sender,
      chat,
      originalSender,
      ageMinSeconds,
      isAdmin,
    };
  },
)(SuggestedPostApproval));
