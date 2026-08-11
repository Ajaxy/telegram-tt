import { memo, useEffect } from '@teact';
import { getActions, withGlobal } from '../../../global';

import type { TabState } from '../../../global/types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { selectTheme, selectThemeValues } from '../../../global/selectors';
import captureEscKeyListener from '../../../util/captureEscKeyListener';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLastCallback from '../../../hooks/useLastCallback';

import Wallpaper from '../../common/Wallpaper';
import MessageList from '../../middle/MessageList';
import Modal from '../../ui/Modal';
import QuickPreviewModalHeader from './QuickPreviewModalHeader';

import styles from './QuickPreviewModal.module.scss';

export type OwnProps = {
  modal: TabState['quickPreview'];
};

type StateProps = {
  // Only used to tell `MessageList` whether the default background is active
  customBackground?: string;
  backgroundColor?: string;
};

const QuickPreviewModal = ({
  modal,
  customBackground,
  backgroundColor,
}: OwnProps & StateProps) => {
  const { closeQuickPreview, openChat, openThread } = getActions();

  const chatId = modal?.chatId;
  const threadId = modal?.threadId;
  const isOpen = Boolean(chatId);

  const handleClose = useLastCallback(() => {
    closeQuickPreview();
  });

  const handleContentClick = useLastCallback(() => {
    if (chatId) {
      if (threadId) {
        openThread({ chatId, threadId, shouldReplaceHistory: true });
      } else {
        openChat({ id: chatId, shouldReplaceHistory: true });
      }
      closeQuickPreview();
    }
  });

  useEffect(() => isOpen ? captureEscKeyListener(handleClose) : undefined, [isOpen, handleClose]);

  useHistoryBack({
    isActive: isOpen,
    onBack: handleClose,
  });

  const { chatId: renderingChatId, threadId: renderingThreadId } = useCurrentOrPrev(modal, true) || {};

  if (!renderingChatId) {
    return undefined;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      header={<QuickPreviewModalHeader chatId={renderingChatId} threadId={renderingThreadId} onClose={handleClose} />}
      className={styles.root}
      contentClassName={styles.content}
    >
      <Wallpaper className={styles.column} isStatic onClick={handleContentClick}>
        <div className={styles.messagesLayout}>
          <MessageList
            chatId={renderingChatId}
            threadId={renderingThreadId || MAIN_THREAD_ID}
            type="thread"
            canPost={false}
            hasFooter={false}
            isReady
            withDefaultBg={Boolean(!customBackground && !backgroundColor)}
            isQuickPreview
          />
        </div>
      </Wallpaper>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => {
  const { background: customBackground, backgroundColor } = selectThemeValues(global, selectTheme(global)) || {};

  return {
    customBackground,
    backgroundColor,
  };
})(QuickPreviewModal));
