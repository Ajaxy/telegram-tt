import React, { FC, useCallback, memo } from '../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../lib/teact/teactn';

import useLang from '../../hooks/useLang';
import { selectChatMessage } from '../../modules/selectors';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';

import Modal from '../ui/Modal';
import Button from '../ui/Button';
import PrivateChatInfo from './PrivateChatInfo';
import ListItem from '../ui/ListItem';

export type OwnProps = {
  isOpen: boolean;
};

export type StateProps = {
  memberIds?: string[];
};

const CLOSE_ANIMATION_DURATION = 100;

const SeenByModal: FC<OwnProps & StateProps> = ({
  isOpen,
  memberIds,
}) => {
  const {
    openChat,
    closeSeenByModal,
  } = getDispatch();

  const lang = useLang();

  const handleClick = useCallback((userId: string) => {
    closeSeenByModal();

    setTimeout(() => {
      openChat({ id: userId });
    }, CLOSE_ANIMATION_DURATION);
  }, [closeSeenByModal, openChat]);

  const renderingMemberIds = useCurrentOrPrev(memberIds, true);

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeSeenByModal}
      className="narrow"
      title="Which users read the message"
    >
      <div dir={lang.isRtl ? 'rtl' : undefined}>
        {renderingMemberIds && renderingMemberIds.map((userId) => (
          <ListItem
            key={userId}
            className="chat-item-clickable scroll-item small-icon"
            onClick={() => handleClick(userId)}
          >
            <PrivateChatInfo userId={userId} noStatusOrTyping />
          </ListItem>
        ))}
      </div>
      <Button
        className="confirm-dialog-button"
        isText
        onClick={closeSeenByModal}
      >
        {lang('Close')}
      </Button>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { chatId, messageId } = global.seenByModal || {};
    if (!chatId || !messageId) {
      return {};
    }

    return {
      memberIds: selectChatMessage(global, chatId, messageId)?.seenByUserIds,
    };
  },
)(SeenByModal));
