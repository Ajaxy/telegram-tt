import type { FC } from '@teact';
import { memo, useEffect } from '@teact';
import { getActions, withGlobal } from '../../../global';

import type { TabState } from '../../../global/types';
import type { ThemeKey } from '../../../types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { selectTheme, selectThemeValues } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import captureEscKeyListener from '../../../util/captureEscKeyListener';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useCustomBackground from '../../../hooks/useCustomBackground';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLastCallback from '../../../hooks/useLastCallback';

import MessageList from '../../middle/MessageList';
import Modal from '../../ui/Modal';
import QuickPreviewModalHeader from './QuickPreviewModalHeader';

import backgroundStyles from '../../../styles/_patternBackground.module.scss';
import styles from './QuickPreviewModal.module.scss';

export type OwnProps = {
  modal: TabState['quickPreview'];
};

type StateProps = {
  theme: ThemeKey;
  customBackground?: string;
  backgroundColor?: string;
  patternColor?: string;
  isBackgroundBlurred?: boolean;
};

const QuickPreviewModal: FC<OwnProps & StateProps> = ({
  modal,
  theme,
  customBackground,
  backgroundColor,
  patternColor,
  isBackgroundBlurred,
}) => {
  const { closeQuickPreview, openChat, openThread } = getActions();

  const chatId = modal?.chatId;
  const threadId = modal?.threadId;
  const isOpen = Boolean(chatId);
  const customBackgroundValue = useCustomBackground(theme, customBackground);

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

  const bgClassName = buildClassName(
    backgroundStyles.background,
    customBackground && backgroundStyles.customBgImage,
    backgroundColor && backgroundStyles.customBgColor,
    customBackground && isBackgroundBlurred && backgroundStyles.blurred,
  );

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
      <div
        className={styles.column}
        style={buildStyle(
          `--pattern-color: ${patternColor}`,
          backgroundColor && `--theme-background-color: ${backgroundColor}`,
        )}
        onClick={handleContentClick}
      >
        <div
          className={bgClassName}
          style={customBackgroundValue ? `--custom-background: ${customBackgroundValue}` : undefined}
        />
        <div className={styles.messagesLayout}>
          <MessageList
            chatId={renderingChatId}
            threadId={renderingThreadId || MAIN_THREAD_ID}
            type="thread"
            canPost={false}
            isReady
            withDefaultBg={Boolean(!customBackground && !backgroundColor)}
            isQuickPreview
          />
        </div>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>((global, { modal: chatId }): Complete<StateProps> => {
  const theme = selectTheme(global);
  const {
    isBlurred: isBackgroundBlurred, background: customBackground, backgroundColor, patternColor,
  } = selectThemeValues(global, theme) || {};

  return {
    theme,
    customBackground,
    backgroundColor,
    patternColor,
    isBackgroundBlurred,
  };
})(QuickPreviewModal));
