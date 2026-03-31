import { memo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiMessage, ApiPeer } from '../../../../api/types';

import { getPeerTitle } from '../../../../global/helpers/peers';
import { selectSender } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { renderPeerLink } from '../helpers/messageActions';

import useLang from '../../../../hooks/useLang';

import Icon from '../../../common/icons/Icon';

import actionStyles from '../ActionMessage.module.scss';
import styles from './NoForwardsRequest.module.scss';

type OwnProps = {
  message: ApiMessage;
};

type StateProps = {
  sender?: ApiPeer;
};

const SHARING_FEATURES = [
  'NoForwardsRequestForwarding',
  'NoForwardsRequestSaving',
  'NoForwardsRequestCopying',
] as const;

const NoForwardsRequest = ({
  message,
  sender,
}: OwnProps & StateProps) => {
  const lang = useLang();

  const { isOutgoing } = message;

  const peerTitle = sender && getPeerTitle(lang, sender);
  const peerLink = renderPeerLink(sender?.id, peerTitle || lang('ActionFallbackUser'));

  const title = isOutgoing
    ? lang('NoForwardsRequestYouTitle')
    : lang('NoForwardsRequestTitle', { user: peerLink }, { withNodes: true, withMarkdown: false });

  return (
    <div className={buildClassName(actionStyles.contentBox, styles.root)}>
      <div className={styles.title}>
        {title}
      </div>
      <div className={styles.list}>
        {SHARING_FEATURES.map((featureKey) => (
          <div key={featureKey} className={styles.item}>
            <Icon name="check" className={styles.checkIcon} />
            <span>{lang(featureKey)}</span>
          </div>
        ))}
      </div>
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
)(NoForwardsRequest));
