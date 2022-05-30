import type { FC } from '../../lib/teact/teact';
import React, {
  useCallback, memo, useMemo, useEffect, useState, useRef,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiMessage } from '../../api/types';
import { LoadMoreDirection } from '../../types';

import useLang from '../../hooks/useLang';
import { selectChatMessage } from '../../global/selectors';
import useInfiniteScroll from '../../hooks/useInfiniteScroll';
import { getUserFullName } from '../../global/helpers';
import renderText from '../common/helpers/renderText';
import useFlag from '../../hooks/useFlag';
import buildClassName from '../../util/buildClassName';
import { formatIntegerCompact } from '../../util/textFormat';
import { unique } from '../../util/iteratees';

import InfiniteScroll from '../ui/InfiniteScroll';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Avatar from '../common/Avatar';
import ListItem from '../ui/ListItem';
import ReactionStaticEmoji from '../common/ReactionStaticEmoji';
import Loading from '../ui/Loading';

import './ReactorListModal.scss';

const MIN_REACTIONS_COUNT_FOR_FILTERS = 10;

export type OwnProps = {
  isOpen: boolean;
};

export type StateProps = Pick<ApiMessage, 'reactors' | 'reactions' | 'seenByUserIds'> & {
  chatId?: string;
  messageId?: number;
};

const ReactorListModal: FC<OwnProps & StateProps> = ({
  isOpen,
  reactors,
  reactions,
  chatId,
  messageId,
  seenByUserIds,
}) => {
  const {
    loadReactors,
    closeReactorListModal,
    openChat,
  } = getActions();

  // No need for expensive global updates on users, so we avoid them
  const usersById = getGlobal().users.byId;

  const lang = useLang();
  const [isClosing, startClosing, stopClosing] = useFlag(false);
  const [chosenTab, setChosenTab] = useState<string | undefined>(undefined);
  const canShowFilters = reactors && reactions && reactors.count >= MIN_REACTIONS_COUNT_FOR_FILTERS
    && reactions.results.length > 1;
  const chatIdRef = useRef<string>();

  useEffect(() => {
    if (isClosing && !isOpen) {
      stopClosing();
      setChosenTab(undefined);
    }
  }, [isClosing, isOpen, stopClosing]);

  const handleCloseAnimationEnd = useCallback(() => {
    if (chatIdRef.current) {
      openChat({ id: chatIdRef.current });
    }
    closeReactorListModal();
  }, [closeReactorListModal, openChat]);

  const handleClose = useCallback(() => {
    startClosing();
  }, [startClosing]);

  const handleClick = useCallback((userId: string) => {
    chatIdRef.current = userId;
    handleClose();
  }, [handleClose]);

  const handleLoadMore = useCallback(() => {
    loadReactors({
      chatId,
      messageId,
    });
  }, [chatId, loadReactors, messageId]);

  const allReactions = useMemo(() => {
    return reactors?.reactions ? unique(reactors.reactions.map((l) => l.reaction)) : [];
  }, [reactors?.reactions]);

  const userIds = useMemo(() => {
    if (chosenTab) {
      return reactors?.reactions.filter((l) => l.reaction === chosenTab).map((l) => l.userId);
    }
    return unique(reactors?.reactions.map((l) => l.userId).concat(seenByUserIds || []) || []);
  }, [chosenTab, reactors?.reactions, seenByUserIds]);

  const [viewportIds, getMore] = useInfiniteScroll(
    handleLoadMore, userIds, reactors && reactors.nextOffset === undefined,
  );

  useEffect(() => {
    getMore?.({ direction: LoadMoreDirection.Backwards });
  }, [getMore]);

  return (
    <Modal
      isOpen={isOpen && !isClosing}
      onClose={handleClose}
      className="ReactorListModal narrow"
      title={lang('Reactions')}
      onCloseAnimationEnd={handleCloseAnimationEnd}
    >
      {canShowFilters && (
        <div className="Reactions">
          <Button
            className={buildClassName(!chosenTab && 'chosen')}
            size="tiny"
            ripple
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => setChosenTab(undefined)}
          >
            <i className="icon-heart" />
            {reactors?.count && formatIntegerCompact(reactors.count)}
          </Button>
          {allReactions.map((reaction) => {
            const count = reactions?.results.find((l) => l.reaction === reaction)?.count;
            return (
              <Button
                className={buildClassName(chosenTab === reaction && 'chosen')}
                size="tiny"
                ripple
                // eslint-disable-next-line react/jsx-no-bind
                onClick={() => setChosenTab(reaction)}
              >
                <ReactionStaticEmoji reaction={reaction} className="reaction-filter-emoji" />
                {count && formatIntegerCompact(count)}
              </Button>
            );
          })}
        </div>
      )}

      <div dir={lang.isRtl ? 'rtl' : undefined}>
        {viewportIds?.length ? (
          <InfiniteScroll
            className="reactor-list custom-scroll"
            items={viewportIds}
            onLoadMore={getMore}
          >
            {viewportIds?.map(
              (userId) => {
                const user = usersById[userId];
                const fullName = getUserFullName(user);
                const reaction = reactors?.reactions.find((l) => l.userId === userId)?.reaction;
                return (
                  <ListItem
                    key={userId}
                    className="chat-item-clickable reactors-list-item"
                    // eslint-disable-next-line react/jsx-no-bind
                    onClick={() => handleClick(userId)}
                  >
                    <Avatar user={user} size="medium" />
                    <div className="title">
                      <h3 dir="auto">{fullName && renderText(fullName)}</h3>
                    </div>
                    {reaction && <ReactionStaticEmoji className="reactors-list-emoji" reaction={reaction} />}
                  </ListItem>
                );
              },
            )}
          </InfiniteScroll>
        ) : <Loading />}
      </div>
      <Button
        className="confirm-dialog-button"
        isText
        onClick={closeReactorListModal}
      >
        {lang('Close')}
      </Button>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { chatId, messageId } = global.reactorModal || {};
    const message = chatId && messageId ? selectChatMessage(global, chatId, messageId) : undefined;

    return {
      chatId,
      messageId,
      reactions: message?.reactions,
      reactors: message?.reactors,
      seenByUserIds: message?.seenByUserIds,
    };
  },
)(ReactorListModal));
