import {
  memo,
  useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { GlobalState } from '../../../global/types';

import { getPeerTitle } from '../../../global/helpers/peers';
import { selectPeer } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { throttle } from '../../../util/schedulers';
import renderText from '../../common/helpers/renderText';

import { useShallowSelector } from '../../../hooks/data/useSelector';
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
  topPeerIds?: string[];
  recentlyFoundChatIds?: string[];
};

const SEARCH_CLOSE_TIMEOUT_MS = 250;
const NBSP = '\u00A0';

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

  const topPeersRef = useRef<HTMLDivElement>();

  // Due to the parent Transition, this component never gets unmounted,
  // that's why we use throttled API call on every update.
  useEffect(() => {
    runThrottled(() => {
      loadTopPeers({ category: 'correspondents' });
    });
  }, [loadTopPeers]);

  const topPeersSelector = useCallback((global: GlobalState) => {
    return topPeerIds?.map((peerId) => selectPeer(global, peerId)).filter(Boolean);
  }, [topPeerIds]);
  const topPeers = useShallowSelector(topPeersSelector);
  const shouldRenderTopPeers = Boolean(topPeers?.length);

  useHorizontalScroll(topPeersRef, !shouldRenderTopPeers);

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

  const lang = useLang();

  return (
    <div className="RecentContacts custom-scroll">
      {shouldRenderTopPeers && (
        <div className="top-peers-section" dir={lang.isRtl ? 'rtl' : undefined}>
          <div ref={topPeersRef} className="top-peers">
            {topPeers?.map((peer) => (
              <div
                key={peer.id}
                className="top-peer-item"
                onClick={() => handleClick(peer.id)}
                dir={lang.isRtl ? 'rtl' : undefined}
              >
                <Avatar peer={peer} />
                <div className="top-peer-name">{renderText(getPeerTitle(lang, peer) || NBSP)}</div>
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
              !shouldRenderTopPeers && 'without-border',
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
    const topPeerIds = global.topPeerCategories.correspondents?.peerIds;
    const { recentlyFoundChatIds } = global;

    return {
      topPeerIds,
      recentlyFoundChatIds,
    };
  },
)(RecentContacts));
