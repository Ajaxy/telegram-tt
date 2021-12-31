import React, {
  FC, useCallback, memo, useRef,
} from '../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../lib/teact/teactn';

import { MessageListType } from '../../global/types';
import { MAIN_THREAD_ID } from '../../api/types';

import { selectChat, selectCurrentMessageList } from '../../modules/selectors';
import { formatIntegerCompact } from '../../util/textFormat';
import buildClassName from '../../util/buildClassName';
import fastSmoothScroll from '../../util/fastSmoothScroll';
import useLang from '../../hooks/useLang';

import Button from '../ui/Button';

import './ScrollDownButton.scss';

type OwnProps = {
  isShown: boolean;
  canPost?: boolean;
  withExtraShift?: boolean;
};

type StateProps = {
  messageListType?: MessageListType;
  unreadCount?: number;
};

const FOCUS_MARGIN = 20;

const ScrollDownButton: FC<OwnProps & StateProps> = ({
  isShown,
  canPost,
  messageListType,
  unreadCount,
  withExtraShift,
}) => {
  const { focusNextReply } = getDispatch();

  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const elementRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(() => {
    if (!isShown) {
      return;
    }

    if (messageListType === 'thread') {
      focusNextReply();
    } else {
      const messagesContainer = elementRef.current!.parentElement!.querySelector<HTMLDivElement>('.MessageList')!;
      const messageElements = messagesContainer.querySelectorAll<HTMLDivElement>('.message-list-item');
      const lastMessageElement = messageElements[messageElements.length - 1];
      if (!lastMessageElement) {
        return;
      }

      fastSmoothScroll(messagesContainer, lastMessageElement, 'end', FOCUS_MARGIN);
    }
  }, [isShown, messageListType, focusNextReply]);

  const fabClassName = buildClassName(
    'ScrollDownButton',
    isShown && 'revealed',
    !canPost && 'no-composer',
    withExtraShift && 'with-extra-shift',
  );

  return (
    <div ref={elementRef} className={fabClassName}>
      <div className="ScrollDownButton-inner">
        <Button
          color="secondary"
          round
          onClick={handleClick}
          ariaLabel={lang('AccDescrPageDown')}
        >
          <i className="icon-arrow-down" />
        </Button>
        {Boolean(unreadCount) && (
          <div className="unread-count">{formatIntegerCompact(unreadCount!)}</div>
        )}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const currentMessageList = selectCurrentMessageList(global);
    if (!currentMessageList) {
      return {};
    }

    const { chatId, threadId, type: messageListType } = currentMessageList;
    const chat = selectChat(global, chatId);

    return {
      messageListType,
      unreadCount: chat && threadId === MAIN_THREAD_ID && messageListType === 'thread' ? chat.unreadCount : undefined,
    };
  },
)(ScrollDownButton));
