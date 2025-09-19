import { memo, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { selectChatMessage, selectTabState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatDateAtTime } from '../../util/dates/dateFormat';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Button from '../ui/Button';
import ListItem from '../ui/ListItem';
import Modal from '../ui/Modal';
import PrivateChatInfo from './PrivateChatInfo';

import styles from './SeenByModal.module.scss';

export type OwnProps = {
  isOpen: boolean;
};

export type StateProps = {
  seenByDates?: Record<string, number>;
};

const CLOSE_ANIMATION_DURATION = 100;

function SeenByModal({
  isOpen,
  seenByDates,
}: OwnProps & StateProps) {
  const {
    openChat,
    closeSeenByModal,
  } = getActions();

  const lang = useOldLang();

  const renderingSeenByDates = useCurrentOrPrev(seenByDates, true);
  const memberIds = useMemo(() => {
    if (!renderingSeenByDates) {
      return undefined;
    }

    const result = Object.keys(renderingSeenByDates);
    result.sort((leftId, rightId) => renderingSeenByDates[rightId] - renderingSeenByDates[leftId]);

    return result;
  }, [renderingSeenByDates]);

  const handleClick = useLastCallback((userId: string) => {
    closeSeenByModal();

    setTimeout(() => {
      openChat({ id: userId });
    }, CLOSE_ANIMATION_DURATION);
  });

  const handleCloseSeenByModal = useLastCallback(() => {
    closeSeenByModal();
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeSeenByModal}
      className={buildClassName(styles.modal, 'narrow')}
      title={`Seen by ${memberIds?.length} users`}
    >
      <div dir={lang.isRtl ? 'rtl' : undefined}>
        {memberIds && memberIds.map((userId) => (
          <ListItem
            key={userId}
            className="chat-item-clickable scroll-item small-icon"

            onClick={() => handleClick(userId)}
          >
            <PrivateChatInfo
              userId={userId}
              noStatusOrTyping
              status={formatDateAtTime(lang, renderingSeenByDates![userId] * 1000)}
              statusIcon="message-read"
            />
          </ListItem>
        ))}
      </div>
      <div className="dialog-buttons mt-2">
        <Button
          className="confirm-dialog-button"
          isText
          onClick={handleCloseSeenByModal}
        >
          {lang('Close')}
        </Button>
      </div>
    </Modal>
  );
}

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { chatId, messageId } = selectTabState(global).seenByModal || {};
    if (!chatId || !messageId) {
      return {
        seenByDates: undefined,
      };
    }

    return {
      seenByDates: selectChatMessage(global, chatId, messageId)?.seenByDates,
    };
  },
)(SeenByModal));
