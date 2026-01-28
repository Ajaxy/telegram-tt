import { memo } from '@teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiChat } from '../../../../api/types';

import { selectChat } from '../../../../global/selectors';
import {
  selectIsTelebizBulkSendActive,
  selectTelebizBulkSendCurrentTarget,
  selectTelebizBulkSendProgress,
} from '../../../global/selectors/bulkSend';

import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import PeerChip from '../../../../components/common/PeerChip';
import Button from '../../../../components/ui/Button';

import styles from './BulkSendProgressIndicator.module.scss';

type StateProps = {
  isActive: boolean;
  progress: {
    total: number;
    completed: number;
    percentage: number;
    isCompleted: boolean;
    successCount: number;
    failedCount: number;
    currentIndex: number;
  };
  currentChat?: ApiChat;
};

const BulkSendProgressIndicator = ({
  isActive,
  progress,
  currentChat,
}: StateProps) => {
  const { cancelTelebizBulkSend, resetTelebizBulkSend, openChat } = getActions();
  const lang = useTelebizLang();

  const handleCancel = useLastCallback(() => {
    cancelTelebizBulkSend();
  });

  const handleDismiss = useLastCallback(() => {
    resetTelebizBulkSend();
  });

  if (!isActive) return undefined;

  const isCompleted = progress.isCompleted;
  const currentNum = Math.min(progress.currentIndex + 1, progress.total);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {!isCompleted && currentChat && (
          <div className={styles.chatName}>
            <PeerChip
              peerId={currentChat.id}
              onClick={() => openChat({
                id: currentChat.id,
              })}
            />
          </div>
        )}
        <Button
          className={styles.cancelButton}
          size="tiny"
          pill
          fluid
          color={isCompleted ? 'primary' : 'danger'}
          onClick={isCompleted ? handleDismiss : handleCancel}
        >
          {lang('Agent.Skills.Modal.Cancel')}
        </Button>
      </div>
      <div className={styles.titleRow}>
        <span className={styles.title}>
          {lang('BulkSend.Sending')}
        </span>
        <span className={styles.counter}>
          {currentNum}
          /
          {progress.total}
        </span>
      </div>
      {!isCompleted && (
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={`width: ${progress.percentage}%`}
          />
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal((global): StateProps => {
  const isActive = selectIsTelebizBulkSendActive(global);
  const progress = selectTelebizBulkSendProgress(global);
  const currentTargetChatId = selectTelebizBulkSendCurrentTarget(global);
  const currentChat = currentTargetChatId ? selectChat(global, currentTargetChatId) : undefined;

  return {
    isActive,
    progress,
    currentChat,
  };
})(BulkSendProgressIndicator));
