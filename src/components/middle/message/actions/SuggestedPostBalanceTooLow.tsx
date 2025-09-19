import { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiMessage, ApiPeer } from '../../../../api/types';
import type { ApiMessageActionSuggestedPostApproval } from '../../../../api/types/messageActions';

import { STARS_CURRENCY_CODE, TON_CURRENCY_CODE } from '../../../../config';
import { getPeerFullTitle } from '../../../../global/helpers/peers';
import { selectChatMessage, selectSender } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { renderPeerLink } from '../helpers/messageActions';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Sparkles from '../../../common/Sparkles';

import styles from '../ActionMessage.module.scss';

type OwnProps = {
  message: ApiMessage;
  action: ApiMessageActionSuggestedPostApproval;
  onClick?: NoneToVoidFunction;
};

type StateProps = {
  sender?: ApiPeer;
  replyMessageSender?: ApiPeer;
  replyMessage?: ApiMessage;
};

const SuggestedPostBalanceTooLow = ({
  onClick,
  message,
  sender,
  replyMessageSender,
  replyMessage,
}: OwnProps & StateProps) => {
  const { openStarsBalanceModal } = getActions();
  const lang = useLang();

  const handleGetMoreStars = useLastCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openStarsBalanceModal({});
  });

  const targetPeer = replyMessageSender || sender;
  const peerTitle = targetPeer && getPeerFullTitle(lang, targetPeer);
  const peerLink = renderPeerLink(targetPeer?.id, peerTitle || lang('ActionFallbackUser'));

  const currency = replyMessage?.suggestedPostInfo?.price?.currency || STARS_CURRENCY_CODE;
  const currencyName = currency === TON_CURRENCY_CODE ? lang('CurrencyTon') : lang('CurrencyStars');
  const buyButtonText = currency === TON_CURRENCY_CODE ? lang('ButtonTopUpViaFragment') : lang('ButtonBuyStars');

  return (
    <div
      className={buildClassName(styles.contentBox, styles.suggestedPostBalanceTooLowBox)}
      onClick={onClick}
    >
      <div className={styles.suggestedPostBalanceTooLowTitle}>
        {lang('SuggestedPostBalanceTooLow', {
          peer: peerLink,
          currency: currencyName,
        }, { withNodes: true, withMarkdown: true })}
      </div>

      {!message.isOutgoing && (
        <div className={styles.actionButton} onClick={handleGetMoreStars}>
          <Sparkles preset="button" />
          {buyButtonText}
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message }): Complete<StateProps> => {
    const sender = selectSender(global, message);

    const replyMessage = message.replyInfo?.type === 'message' && message.replyInfo.replyToMsgId
      ? selectChatMessage(global, message.chatId, message.replyInfo.replyToMsgId)
      : undefined;

    const replyMessageSender = replyMessage ? selectSender(global, replyMessage) : undefined;

    return {
      sender,
      replyMessageSender,
      replyMessage,
    };
  },
)(SuggestedPostBalanceTooLow));
