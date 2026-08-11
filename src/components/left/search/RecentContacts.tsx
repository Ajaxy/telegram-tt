import {
  memo,
  useCallback, useEffect,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { throttle } from '../../../util/schedulers';

import ListTopPeers from '../../common/ListTopPeers';
import Island from '../../gili/layout/Island';
import RecentContactsList from './RecentContactsList';

import './RecentContacts.scss';

type OwnProps = {
  onReset: () => void;
};

type StateProps = {
  topPeerIds?: string[];
  recentlyFoundChatIds?: string[];
};

const SEARCH_CLOSE_TIMEOUT_MS = 250;

const runThrottled = throttle((cb) => cb(), 60000, true);

const RecentContacts = ({
  topPeerIds,
  recentlyFoundChatIds,
  onReset,
}: OwnProps & StateProps) => {
  const {
    loadTopPeers, openChat,
    addRecentlyFoundChatId, clearRecentlyFoundChats,
  } = getActions();

  // Due to the parent Transition, this component never gets unmounted,
  // that's why we use throttled API call on every update.
  useEffect(() => {
    runThrottled(() => {
      loadTopPeers({ category: 'correspondents' });
    });
  }, [loadTopPeers]);

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

  return (
    <div className="RecentContacts custom-scroll">
      {topPeerIds?.length ? (
        <Island className="search-island island-recent-contacts">
          <ListTopPeers peerIds={topPeerIds} onPeerClick={handleClick} />
        </Island>
      ) : undefined}
      {recentlyFoundChatIds && (
        <RecentContactsList
          chatIds={recentlyFoundChatIds}
          noTopBorder={!topPeerIds?.length}
          onChatClick={handleClick}
          onClear={handleClearRecentlyFoundChats}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const topPeerIds = global.topPeerCategories.correspondents?.peerIds;
    const { recentlyFoundChatIds } = global;

    return {
      topPeerIds,
      recentlyFoundChatIds,
    };
  },
)(RecentContacts));
