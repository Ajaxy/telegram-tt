import {
  memo,
  useCallback, useEffect,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { throttle } from '../../../util/schedulers';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import ListTopPeers from '../../common/ListTopPeers';
import Island from '../../gili/layout/Island';
import ConfirmDialog from '../../ui/ConfirmDialog';
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

  const lang = useLang();

  const [isClearConfirmOpen, openClearConfirm, closeClearConfirm] = useFlag();

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

  const handleClearRecentlyFoundChats = useLastCallback(() => {
    closeClearConfirm();
    clearRecentlyFoundChats();
  });

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
          onClear={openClearConfirm}
        />
      )}
      <ConfirmDialog
        isOpen={isClearConfirmOpen}
        text={lang('ClearSearchAlert')}
        confirmLabel={lang('Clear')}
        confirmIsDestructive
        confirmHandler={handleClearRecentlyFoundChats}
        onClose={closeClearConfirm}
      />
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
