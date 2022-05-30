import type { FC } from '../../../lib/teact/teact';
import React, {
  useEffect, useCallback, useRef, memo,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';

import { getUserFirstOrLastName } from '../../../global/helpers';
import renderText from '../../common/helpers/renderText';
import { throttle } from '../../../util/schedulers';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useLang from '../../../hooks/useLang';

import Avatar from '../../common/Avatar';
import Button from '../../ui/Button';
import LeftSearchResultChat from './LeftSearchResultChat';

import './RecentContacts.scss';

type OwnProps = {
  onReset: () => void;
};

type StateProps = {
  topUserIds?: string[];
  usersById: Record<string, ApiUser>;
  recentlyFoundChatIds?: string[];
};

const SEARCH_CLOSE_TIMEOUT_MS = 250;
const NBSP = '\u00A0';

const runThrottled = throttle((cb) => cb(), 60000, true);

const RecentContacts: FC<OwnProps & StateProps> = ({
  topUserIds, usersById, recentlyFoundChatIds,
  onReset,
}) => {
  const {
    loadTopUsers, openChat,
    addRecentlyFoundChatId, clearRecentlyFoundChats,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const topUsersRef = useRef<HTMLDivElement>(null);

  // Due to the parent Transition, this component never gets unmounted,
  // that's why we use throttled API call on every update.
  useEffect(() => {
    runThrottled(() => {
      loadTopUsers();
    });
  }, [loadTopUsers]);

  useHorizontalScroll(topUsersRef.current, !topUserIds);

  const handleClick = useCallback((id: string) => {
    openChat({ id, shouldReplaceHistory: true });
    onReset();
    setTimeout(() => {
      addRecentlyFoundChatId({ id });
    }, SEARCH_CLOSE_TIMEOUT_MS);
  }, [openChat, addRecentlyFoundChatId, onReset]);

  const lang = useLang();

  return (
    <div className="RecentContacts custom-scroll">
      {topUserIds && (
        <div className="top-peers-section" dir={lang.isRtl ? 'rtl' : undefined}>
          <div ref={topUsersRef} className="top-peers no-selection">
            {topUserIds.map((userId) => (
              <div className="top-peer-item" onClick={() => handleClick(userId)} dir={lang.isRtl ? 'rtl' : undefined}>
                <Avatar user={usersById[userId]} />
                <div className="top-peer-name">{renderText(getUserFirstOrLastName(usersById[userId]) || NBSP)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {recentlyFoundChatIds && (
        <div className="search-section pt-1">
          <h3 className="section-heading mt-0 recent-chats-header" dir={lang.isRtl ? 'rtl' : undefined}>
            {lang('Recent')}

            <Button
              round
              size="smaller"
              color="translucent"
              ariaLabel="Clear recent chats"
              onClick={clearRecentlyFoundChats}
              isRtl={lang.isRtl}
            >
              <i className="icon-close" />
            </Button>
          </h3>
          {recentlyFoundChatIds.map((id) => (
            <LeftSearchResultChat
              chatId={id}
              onClick={handleClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { userIds: topUserIds } = global.topPeers;
    const usersById = global.users.byId;
    const { recentlyFoundChatIds } = global.globalSearch;

    return {
      topUserIds,
      usersById,
      recentlyFoundChatIds,
    };
  },
)(RecentContacts));
