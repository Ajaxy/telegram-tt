import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiChat,
} from '../../../api/types';

import {
} from '../../../global/helpers';
import { getPeerTitle } from '../../../global/helpers/peers';
import {
  selectChat,
  selectUserFullInfo,
} from '../../../global/selectors';
import { formatStarsAsIcon } from '../../../util/localization/format';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useHeaderPane, { type PaneState } from '../hooks/useHeaderPane';

import Button from '../../ui/Button';

import styles from './PaidMessageChargePane.module.scss';

type OwnProps = {
  peerId: string;
  onPaneStateChange?: (state: PaneState) => void;
};

type StateProps = {
  chargedPaidMessageStars?: number;
  chat?: ApiChat;
};

const PaidMessageChargePane: FC<OwnProps & StateProps> = ({
  chargedPaidMessageStars,
  chat,
  peerId,
  onPaneStateChange,
}) => {
  const isOpen = Boolean(chargedPaidMessageStars);
  const lang = useLang();

  const {
    openChatRefundModal,
  } = getActions();

  const { ref, shouldRender } = useHeaderPane({
    isOpen,
    onStateChange: onPaneStateChange,
  });

  const handleRefund = useLastCallback(() => {
    openChatRefundModal({ userId: peerId });
  });

  if (!shouldRender || !chargedPaidMessageStars) return undefined;

  const peerName = chat ? getPeerTitle(lang, chat) : undefined;

  const message = lang('PaneMessagePaidMessageCharge', {
    peer: peerName,
    amount: formatStarsAsIcon(lang,
      chargedPaidMessageStars,
      { asFont: true }),
  }, {
    withMarkdown: true,
    withNodes: true,
  });

  return (
    <div ref={ref} className={styles.root}>
      <span className={styles.message}>
        {message}
      </span>
      <Button
        isText
        noForcedUpperCase
        pill
        fluid
        size="tiny"
        className={styles.button}
        onClick={handleRefund}
      >
        {lang('RemoveFeeTitle')}
      </Button>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { peerId }): Complete<StateProps> => {
    const chat = selectChat(global, peerId);
    const peerFullInfo = selectUserFullInfo(global, peerId);
    const chargedPaidMessageStars = peerFullInfo?.settings?.chargedPaidMessageStars;

    return {
      chargedPaidMessageStars,
      chat,
    };
  },
)(PaidMessageChargePane));
