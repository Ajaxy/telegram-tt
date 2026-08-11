import type { FC } from '../../../lib/teact/teact';
import { memo, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiBotVerification } from '../../../api/types';

import {
  selectPeerFullInfo,
} from '../../../global/selectors';

import useFrozenProps from '../../../hooks/useFrozenProps';
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

  const { botVerification: renderingBotVerification } = useFrozenProps({ botVerification }, !isOpen);

  const {
    markBotVerificationInfoShown,
  } = getActions();

  const { ref, shouldRender } = useHeaderPane({
    isOpen,
    measureKey: peerId,
    withResizeObserver: true,
    onStateChange: onPaneStateChange,
  });

  const markAsShowed = useLastCallback(() => {
    markBotVerificationInfoShown({ peerId });
  });
  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = window.setTimeout(markAsShowed, DISPLAY_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen, peerId]);

  if (!shouldRender || !renderingBotVerification) return undefined;

  return (
    <div ref={ref} className={styles.root}>
      <span className={styles.icon}>
        <CustomEmoji
          documentId={renderingBotVerification.iconId}
          size={BOT_VERIFICATION_ICON_SIZE}
        />
      </span>
      {renderingBotVerification.description}
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
