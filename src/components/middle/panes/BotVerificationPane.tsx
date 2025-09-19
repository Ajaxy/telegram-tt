import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiBotVerification } from '../../../api/types';

import {
  selectPeerFullInfo,
} from '../../../global/selectors';

import useTimeout from '../../../hooks/schedulers/useTimeout';
import useLastCallback from '../../../hooks/useLastCallback';
import useHeaderPane, { type PaneState } from '../hooks/useHeaderPane';

import CustomEmoji from '../../common/CustomEmoji';

import styles from './BotVerificationPane.module.scss';

type OwnProps = {
  peerId: string;
  onPaneStateChange?: (state: PaneState) => void;
};

type StateProps = {
  wasShown: boolean;
  botVerification?: ApiBotVerification;
};
const BOT_VERIFICATION_ICON_SIZE = 16;
const DISPLAY_DURATION_MS = 5000; // 5 sec

const BotVerificationPane: FC<OwnProps & StateProps> = ({
  peerId,
  wasShown,
  botVerification,
  onPaneStateChange,
}) => {
  const isOpen = Boolean(!wasShown && botVerification);

  const {
    markBotVerificationInfoShown,
  } = getActions();

  const { ref, shouldRender } = useHeaderPane({
    isOpen,
    onStateChange: onPaneStateChange,
  });

  const markAsShowed = useLastCallback(() => {
    markBotVerificationInfoShown({ peerId });
  });
  useTimeout(markAsShowed, !wasShown ? DISPLAY_DURATION_MS : undefined);

  if (!shouldRender || !botVerification) return undefined;

  return (
    <div ref={ref} className={styles.root}>
      <span className={styles.icon}>
        <CustomEmoji
          documentId={botVerification.iconId}
          size={BOT_VERIFICATION_ICON_SIZE}
        />
      </span>
      {botVerification.description}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { peerId }): Complete<StateProps> => {
    const peerFullInfo = selectPeerFullInfo(global, peerId);

    const botVerification = peerFullInfo?.botVerification;
    const wasShown = global.settings.botVerificationShownPeerIds.includes(peerId);

    return {
      botVerification,
      wasShown,
    };
  },
)(BotVerificationPane));
