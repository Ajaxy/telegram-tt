import { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiMessage, ApiPeer } from '../../../../api/types';
import type { ApiMessageActionSuggestedPostApproval } from '../../../../api/types/messageActions';

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
};

const SuggestedPostBalanceTooLow = ({
  onClick,
  message,
  sender,
  replyMessageSender,
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

  return (
    <div
      className={buildClassName(styles.contentBox, styles.suggestedPostBalanceTooLowBox)}
      onClick={onClick}
    >
      <div className={styles.suggestedPostBalanceTooLowTitle}>
        {lang('SuggestedPostBalanceTooLow', {
          peer: peerLink,
          currency: lang('CurrencyStars'),
        }, { withNodes: true, withMarkdown: true })}
      </div>

      {!message.isOutgoing && (
        <div className={styles.actionButton} onClick={handleGetMoreStars}>
          <Sparkles preset="button" />
          {lang('ButtonBuyStars')}
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message }): StateProps => {
    const sender = selectSender(global, message);

    const replyMessage = message.replyInfo?.type === 'message' && message.replyInfo.replyToMsgId
      ? selectChatMessage(global, message.chatId, message.replyInfo.replyToMsgId)
      : undefined;

    const replyMessageSender = replyMessage ? selectSender(global, replyMessage) : undefined;

    return {
      sender,
      replyMessageSender,
    };
  },
)(SuggestedPostBalanceTooLow));
