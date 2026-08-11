import {
  memo, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';
import type { TabState } from '../../../global/types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { getMockPreparedMessageFromResult, getUserFullName } from '../../../global/helpers';
import { selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Wallpaper from '../../common/Wallpaper';
import Message from '../../middle/message/Message';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './PreparedMessageModal.module.scss';

export type OwnProps = {
  modal: TabState['preparedMessageModal'];
};

type StateProps = {
  bot?: ApiUser;
};

const PreparedMessageModal = ({
  modal,
  bot,
}: OwnProps & StateProps) => {
  const {
    closePreparedInlineMessageModal, sendWebAppEvent, openSharePreparedMessageModal,
  } = getActions();
  const lang = useLang();
  const isOpen = Boolean(modal);

  const { webAppKey, message, botId } = modal || {};

  const containerRef = useRef<HTMLDivElement>();

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

  return (
    <Modal
      dialogRef={containerRef}
      isOpen={isOpen}
      header={header}
      onClose={handleCloseClick}
      className={styles.root}
      contentClassName={styles.content}
    >
      <Wallpaper className={buildClassName(styles.actionMessageView, 'MessageList')} inert isStatic>
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
      </Wallpaper>
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
  (global, { modal }): Complete<StateProps> => {
    const bot = modal ? selectUser(global, modal?.botId) : undefined;

    return {
      bot,
    };
  },
)(PreparedMessageModal));
