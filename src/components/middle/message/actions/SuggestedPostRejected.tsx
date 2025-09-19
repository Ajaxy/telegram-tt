import { memo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiMessage, ApiPeer } from '../../../../api/types';
import type { ApiMessageActionSuggestedPostApproval } from '../../../../api/types/messageActions';

import { getPeerTitle } from '../../../../global/helpers/peers';
import { selectSender } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { renderPeerLink, translateWithYou } from '../helpers/messageActions';

import useLang from '../../../../hooks/useLang';

import Icon from '../../../common/icons/Icon';

import styles from '../ActionMessage.module.scss';

type OwnProps = {
  message: ApiMessage;
  action: ApiMessageActionSuggestedPostApproval;
  onClick?: NoneToVoidFunction;
};

type StateProps = {
  sender?: ApiPeer;
};

const SuggestedPostRejected = ({
  message,
  action,
  sender,
  onClick,
}: OwnProps & StateProps) => {
  const lang = useLang();
  const { isOutgoing } = message;
  const { rejectComment } = action;

  const senderTitle = sender && getPeerTitle(lang, sender);
  const senderLink = renderPeerLink(sender?.id, senderTitle || lang('ActionFallbackUser'));

  return (
    <div
      className={buildClassName(styles.contentBox, styles.suggestedPostRejectedContentBox)}
      onClick={onClick}
    >
      <div className={styles.suggestedPostRejectedTitle}>
        <Icon className={styles.rejectedIcon} name="close" />
        {translateWithYou(
          lang,
          rejectComment ? 'SuggestedPostRejectedWithReason' : 'SuggestedPostRejected',
          isOutgoing,
          { peer: senderLink },
          { withMarkdown: true },
        )}
      </div>

      {rejectComment && (
        <div className={styles.suggestedPostRejectedComment}>
          {lang('SuggestedPostRejectedComment', { comment: rejectComment })}
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message }): Complete<StateProps> => {
    const sender = selectSender(global, message);

    return {
      sender,
    };
  },
)(SuggestedPostRejected));
