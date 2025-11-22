import {
  type FC,
  memo, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { ThemeKey } from '../../../types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { getMockPreparedMessageFromResult, getUserFullName } from '../../../global/helpers';
import { selectTheme, selectThemeValues, selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';

import useCustomBackground from '../../../hooks/useCustomBackground';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Message from '../../middle/message/Message';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './PreparedMessageModal.module.scss';

export type OwnProps = {
  modal: TabState['preparedMessageModal'];
};

type StateProps = {
  theme: ThemeKey;
  isBackgroundBlurred?: boolean;
  patternColor?: string;
  customBackground?: string;
  backgroundColor?: string;
  bot?: ApiUser;
};

const PreparedMessageModal: FC<OwnProps & StateProps> = ({
  modal,
  theme,
  isBackgroundBlurred,
  patternColor,
  customBackground,
  backgroundColor,
  bot,
}) => {
  const {
    closePreparedInlineMessageModal, sendWebAppEvent, openSharePreparedMessageModal,
  } = getActions();
  const lang = useLang();
  const isOpen = Boolean(modal);

  const { webAppKey, message, botId } = modal || {};

  const containerRef = useRef<HTMLDivElement>();

  const customBackgroundValue = useCustomBackground(theme, customBackground);

  const handleOpenClick = useLastCallback(() => {
    if (webAppKey && botId && message) {
      openSharePreparedMessageModal({
        webAppKey,
        message,
      });
      closePreparedInlineMessageModal();
    }
  });

  const handleCloseClick = useLastCallback(() => {
    closePreparedInlineMessageModal();
    if (webAppKey) {
      sendWebAppEvent({
        webAppKey,
        event: {
          eventType: 'prepared_message_failed',
          eventData: { error: 'USER_DECLINED' },
        },
      });
    }
  });

  const header = useMemo(() => {
    if (!modal) {
      return undefined;
    }

    return (
      <div className={styles.header}>
        <Button
          round
          color="translucent"
          size="smaller"
          ariaLabel={lang('Close')}
          onClick={handleCloseClick}
          iconName="close"
        />
        <h3 className={buildClassName('modal-title', styles.modalTitle)}>
          {lang('BotShareMessage')}
        </h3>
      </div>
    );
  }, [lang, modal]);

  const localMessage = useMemo(() => {
    if (!botId || !message || !webAppKey) return undefined;
    return getMockPreparedMessageFromResult(botId, message);
  }, [botId, message, webAppKey]);

  const bgClassName = buildClassName(
    styles.background,
    styles.withTransition,
    customBackground && styles.customBgImage,
    backgroundColor && styles.customBgColor,
    customBackground && isBackgroundBlurred && styles.blurred,
  );

  return (
    <Modal
      dialogRef={containerRef}
      isOpen={isOpen}
      header={header}
      onClose={handleCloseClick}
      className={styles.root}
      contentClassName={styles.content}
    >
      <div
        className={buildClassName(styles.actionMessageView, 'MessageList')}
        // @ts-ignore -- FIXME: Find a way to disable interactions but keep a11y
        inert
        style={buildStyle(
          `--pattern-color: ${patternColor}`,
          backgroundColor && `--theme-background-color: ${backgroundColor}`,
        )}
      >
        <div
          className={bgClassName}
          style={customBackgroundValue ? `--custom-background: ${customBackgroundValue}` : undefined}
        />
        {localMessage && (
          <Message
            key={botId}
            message={localMessage}
            threadId={MAIN_THREAD_ID}
            messageListType="thread"
            noComments
            noReplies
            appearanceOrder={0}
            isJustAdded={false}
            isFirstInGroup
            isLastInGroup
            isLastInList={false}
            isFirstInDocumentGroup={false}
            isLastInDocumentGroup={false}
          />
        )}
      </div>
      <div className={styles.container}>
        <p className={styles.info}>
          {lang('WebAppShareMessageInfo', { user: getUserFullName(bot) })}
        </p>
        <Button
          onClick={handleOpenClick}
        >
          {lang('BotShareMessageShare')}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }) => {
    const theme = selectTheme(global);
    const {
      isBlurred: isBackgroundBlurred,
      patternColor,
      background: customBackground,
      backgroundColor,
    } = selectThemeValues(global, theme) || {};
    const bot = modal ? selectUser(global, modal?.botId) : undefined;

    return {
      theme,
      isBackgroundBlurred,
      patternColor,
      customBackground,
      backgroundColor,
      bot,
      currentUserId: global.currentUserId,
    };
  },
)(PreparedMessageModal));
