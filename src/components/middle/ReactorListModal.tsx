import type { FC } from '../../lib/teact/teact';
import type React from '../../lib/teact/teact';
import {
  memo, useEffect, useMemo, useRef,
  useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiAvailableReaction, ApiMessage, ApiReaction } from '../../api/types';
import { LoadMoreDirection } from '../../types';

import { getReactionKey, isSameReaction } from '../../global/helpers';
import {
  selectChatMessage,
  selectTabState,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatDateAtTime } from '../../util/dates/dateFormat';
import { unique } from '../../util/iteratees';
import { formatIntegerCompact } from '../../util/textFormat';

import useFlag from '../../hooks/useFlag';
import useInfiniteScroll from '../../hooks/useInfiniteScroll';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Avatar from '../common/Avatar';
import FullNameTitle from '../common/FullNameTitle';
import Icon from '../common/icons/Icon';
import PrivateChatInfo from '../common/PrivateChatInfo';
import ReactionStaticEmoji from '../common/reactions/ReactionStaticEmoji';
import Button from '../ui/Button';
import InfiniteScroll from '../ui/InfiniteScroll';
import ListItem from '../ui/ListItem';
import Loading from '../ui/Loading';
import Modal from '../ui/Modal';

import './ReactorListModal.scss';

const MIN_REACTIONS_COUNT_FOR_FILTERS = 10;

export type OwnProps = {
  isOpen: boolean;
};

export type StateProps = Pick<ApiMessage, 'reactors' | 'reactions' | 'seenByDates'> & {
  chatId?: string;
  messageId?: number;
  availableReactions?: ApiAvailableReaction[];
};

const ReactorListModal: FC<OwnProps & StateProps> = ({
  isOpen,
  reactors,
  reactions,
  chatId,
  messageId,
  seenByDates,
  availableReactions,
}) => {
  const {
    loadReactors,
    closeReactorListModal,
    openChat,
  } = getActions();

  // No need for expensive global updates on chats or users, so we avoid them
  const chatsById = getGlobal().chats.byId;
  const usersById = getGlobal().users.byId;

  const oldLang = useOldLang();
  const lang = useLang();
  const [isClosing, startClosing, stopClosing] = useFlag(false);
  const [chosenTab, setChosenTab] = useState<ApiReaction | undefined>(undefined);
  const canShowFilters = reactors && reactions && reactors.count >= MIN_REACTIONS_COUNT_FOR_FILTERS
    && reactions.results.length > 1;
  const chatIdRef = useRef<string>();

  useEffect(() => {
    if (isOpen && !isClosing) {
      chatIdRef.current = undefined;
    }

    if (isClosing && !isOpen) {
      stopClosing();
      setChosenTab(undefined);
    }
  }, [isClosing, isOpen, stopClosing]);

  const handleCloseAnimationEnd = useLastCallback(() => {
    if (chatIdRef.current) {
      openChat({ id: chatIdRef.current });
    }
    closeReactorListModal();
  });

  const handleClose = useLastCallback(() => {
    startClosing();
  });

  const handleClick = useLastCallback((userId: string) => {
    chatIdRef.current = userId;
    handleClose();
  });

  const handleLoadMore = useLastCallback(() => {
    loadReactors({
      chatId: chatId!,
      messageId: messageId!,
    });
  });

  const allReactions = useMemo(() => {
    const uniqueReactions: ApiReaction[] = [];
    reactors?.reactions?.forEach(({ reaction }) => {
      if (!uniqueReactions.some((r) => isSameReaction(r, reaction))) {
        uniqueReactions.push(reaction);
      }
    });
    return uniqueReactions;
  }, [reactors]);

  const peerIds = useMemo(() => {
    if (chosenTab) {
      return reactors?.reactions
        .filter(({ reaction }) => isSameReaction(reaction, chosenTab))
        .map(({ peerId }) => peerId);
    }

    const seenByUserIds = Object.keys(seenByDates || {});

    return unique(reactors?.reactions.map(({ peerId }) => peerId).concat(seenByUserIds || []) || []);
  }, [chosenTab, reactors, seenByDates]);

  const [viewportIds, getMore] = useInfiniteScroll(
    handleLoadMore, peerIds, reactors && reactors.nextOffset === undefined,
  );

  useEffect(() => {
    getMore?.({ direction: LoadMoreDirection.Backwards });
  }, [getMore]);

  return (
    <Modal
      isOpen={isOpen && !isClosing}
      onClose={handleClose}
      className="ReactorListModal narrow"
      title={oldLang('Reactions')}
      onCloseAnimationEnd={handleCloseAnimationEnd}
    >
      {canShowFilters && (
        <div className="Reactions" dir={lang.isRtl ? 'rtl' : undefined}>
          <Button
            className={buildClassName(!chosenTab && 'chosen')}
            size="tiny"
            ripple

            onClick={() => setChosenTab(undefined)}
          >
            <Icon name="heart" />
            {Boolean(reactors?.count) && formatIntegerCompact(lang, reactors.count)}
          </Button>
          {allReactions.map((reaction) => {
            const count = reactions?.results
              .find((reactionsCount) => isSameReaction(reactionsCount.reaction, reaction))?.count;
            return (
              <Button
                key={getReactionKey(reaction)}
                className={buildClassName(isSameReaction(chosenTab, reaction) && 'chosen')}
                size="tiny"
                ripple

                onClick={() => setChosenTab(reaction)}
              >
                <ReactionStaticEmoji
                  reaction={reaction}
                  className="reaction-filter-emoji"
                  availableReactions={availableReactions}
                />
                {Boolean(count) && formatIntegerCompact(lang, count)}
              </Button>
            );
          })}
        </div>
      )}

      <div dir={lang.isRtl ? 'rtl' : undefined} className="reactor-list-wrapper">
        {viewportIds?.length ? (
          <InfiniteScroll
            className="reactor-list custom-scroll"
            items={viewportIds}
            onLoadMore={getMore}
          >
            {viewportIds?.flatMap(
              (peerId) => {
                const peer = usersById[peerId] || chatsById[peerId];

                const peerReactions = reactors?.reactions.filter((reactor) => reactor.peerId === peerId);
                const items: React.ReactNode[] = [];
                const seenByUser = seenByDates?.[peerId];

                peerReactions?.forEach((r) => {
                  if (chosenTab && !isSameReaction(r.reaction, chosenTab)) return;

                  items.push(
                    <ListItem
                      key={`${peerId}-${getReactionKey(r.reaction)}`}
                      className="chat-item-clickable reactors-list-item"

                      onClick={() => handleClick(peerId)}
                    >
                      <Avatar peer={peer} size="medium" />
                      <div className="info">
                        <FullNameTitle peer={peer} withEmojiStatus />
                        <span className="status" dir="auto">
                          <Icon name="heart-outline" className="status-icon" />
                          {formatDateAtTime(oldLang, r.addedDate * 1000)}
                        </span>
                      </div>
                      {r.reaction && (
                        <ReactionStaticEmoji
                          className="reactors-list-emoji"
                          reaction={r.reaction}
                          availableReactions={availableReactions}
                        />
                      )}
                    </ListItem>,
                  );
                });

                if (!chosenTab && !peerReactions?.length) {
                  items.push(
                    <ListItem
                      key={`${peerId}-seen-by`}
                      className="chat-item-clickable scroll-item small-icon"

                      onClick={() => handleClick(peerId)}
                    >
                      <PrivateChatInfo
                        userId={peerId}
                        noStatusOrTyping
                        avatarSize="medium"
                        status={seenByUser ? formatDateAtTime(oldLang, seenByUser * 1000) : undefined}
                        statusIcon="message-read"
                      />
                    </ListItem>,
                  );
                }
                return items;
              },
            )}
          </InfiniteScroll>
        ) : <Loading />}
      </div>
      <Button
        className="confirm-dialog-button"
        isText
        onClick={handleClose}
      >
        {oldLang('Close')}
      </Button>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { chatId, messageId } = selectTabState(global).reactorModal || {};
    const message = chatId && messageId ? selectChatMessage(global, chatId, messageId) : undefined;

    return {
      chatId,
      messageId,
      reactions: message?.reactions,
      reactors: message?.reactors,
      seenByDates: message?.seenByDates,
      availableReactions: global.reactions.availableReactions,
    };
  },
)(ReactorListModal));
