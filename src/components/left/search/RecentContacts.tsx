import type { FC } from '../../../lib/teact/teact';
import {
  memo,
  useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';

import { getUserFirstOrLastName } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { throttle } from '../../../util/schedulers';
import renderText from '../../common/helpers/renderText';

import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useOldLang from '../../../hooks/useOldLang';

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
  topUserIds,
  usersById,
  recentlyFoundChatIds,
  onReset,
}) => {
  const {
    loadTopUsers, openChat,
    addRecentlyFoundChatId, clearRecentlyFoundChats,
  } = getActions();

  const topUsersRef = useRef<HTMLDivElement>();

  // Due to the parent Transition, this component never gets unmounted,
  // that's why we use throttled API call on every update.
  useEffect(() => {
    runThrottled(() => {
      loadTopUsers();
    });
  }, [loadTopUsers]);

  useHorizontalScroll(topUsersRef, !topUserIds);

  const handleClick = useCallback((id: string) => {
    openChat({ id, shouldReplaceHistory: true });
    onReset();
    setTimeout(() => {
      addRecentlyFoundChatId({ id });
    }, SEARCH_CLOSE_TIMEOUT_MS);
  }, [openChat, addRecentlyFoundChatId, onReset]);

  const handleClearRecentlyFoundChats = useCallback(() => {
    clearRecentlyFoundChats();
  }, [clearRecentlyFoundChats]);

  const lang = useOldLang();

  return (
    <div className="RecentContacts custom-scroll">
      {topUserIds && (
        <div className="top-peers-section" dir={lang.isRtl ? 'rtl' : undefined}>
          <div ref={topUsersRef} className="top-peers">
            {topUserIds.map((userId) => (
              <div
                key={userId}
                className="top-peer-item"
                onClick={() => handleClick(userId)}
                dir={lang.isRtl ? 'rtl' : undefined}
              >
                <Avatar peer={usersById[userId]} />
                <div className="top-peer-name">{renderText(getUserFirstOrLastName(usersById[userId]) || NBSP)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {recentlyFoundChatIds && (
        <div className="search-section pt-1">
          <h3
            className={buildClassName(
              'section-heading mt-0 recent-chats-header',
              !topUserIds && 'without-border',
            )}
            dir={lang.isRtl ? 'rtl' : undefined}
          >
            {lang('Recent')}

            <Button
              className="clear-recent-chats"
              round
              size="smaller"
              color="translucent"
              ariaLabel={lang('Clear')}
              onClick={handleClearRecentlyFoundChats}
              isRtl={lang.isRtl}
              iconName="close"
            />
          </h3>
          {recentlyFoundChatIds.map((id) => (
            <LeftSearchResultChat
              chatId={id}
              withOpenAppButton
              onClick={handleClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { userIds: topUserIds } = global.topPeers;
    const usersById = global.users.byId;
    const { recentlyFoundChatIds } = global;

    return {
      topUserIds,
      usersById,
      recentlyFoundChatIds,
    };
  },
)(RecentContacts));
