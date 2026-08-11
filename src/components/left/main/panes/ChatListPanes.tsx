import {
  memo, useLayoutEffect, useMemo, useRef, useSignal, useUnmountCleanup,
} from '@teact';
import { addExtraClass } from '@teact/teact-dom';
import { withGlobal } from '../../../../global';

import type { ApiPromoData, ApiSession } from '../../../../api/types';

import { FRESH_AUTH_PERIOD } from '../../../../config';
import { selectIsCurrentUserFrozen, selectIsForumPanelOpen } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { getServerTime } from '../../../../util/serverTime';
import { REM } from '../../../common/helpers/mediaDimensions';

import useAppLayout from '../../../../hooks/useAppLayout';
import useCacheBusterRef from '../../../../hooks/useCacheBusterRef';
import { useSignalEffect } from '../../../../hooks/useSignalEffect';
import {
  applyAnimationState, commitInMutatePhase, type PaneState, transitionIslandVisual,
} from '../../../middle/hooks/useHeaderPane';

import AudioPlayer from '../../../middle/panes/AudioPlayer';
import FrozenAccountPane from './FrozenAccountPane';
import GiftAuctionPane from './GiftAuctionPane';
import SuggestionPane from './SuggestionPane';
import UnconfirmedSessionPane from './UnconfirmedSessionPane';

import styles from './ChatListPanes.module.scss';

type OwnProps = {
  className?: string;
  noBanners?: boolean;
  onHeightChange: (height: number) => void;
};

type StateProps = {
  sessions: Record<string, ApiSession>;
  promoData?: ApiPromoData;
  isAccountFrozen?: boolean;
  isForumPanelOpen?: boolean;
};

const BOTTOM_MARGIN = 0.5 * REM;
const FALLBACK_PANE_STATE = { height: 0 };

const ChatListPanes = ({
  className,
  noBanners,
  sessions,
  promoData,
  isAccountFrozen,
  isForumPanelOpen,
  onHeightChange,
}: OwnProps & StateProps) => {
  const [getPlayerState, setPlayerState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getFrozenAccountState, setFrozenAccountState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getUnconfirmedSessionState, setUnconfirmedSessionState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getGiftAuctionState, setGiftAuctionState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getSuggestionState, setSuggestionState] = useSignal<PaneState>(FALLBACK_PANE_STATE);

  const ref = useRef<HTMLDivElement>();
  const [visualTokenRef, invalidateVisualToken] = useCacheBusterRef();
  const suppressRowAnimationsUntilRef = useRef(0);

  const { isMobile, isTablet } = useAppLayout();

  useLayoutEffect(() => {
    if (ref.current) addExtraClass(ref.current, styles.rootHidden);
  }, []);

  // Cancel any in-flight deferred writes when the component unmounts
  useUnmountCleanup(invalidateVisualToken);

  const unconfirmedSession = useMemo(() => {
    const sessionsArray = Object.values(sessions || {});
    const current = sessionsArray.find((session) => session.isCurrent);
    if (!current || getServerTime() - current.dateCreated < FRESH_AUTH_PERIOD) return undefined;

    return sessionsArray.find((session) => session.isUnconfirmed);
  }, [sessions]);

  const canShowUnconfirmedSession = !isAccountFrozen && !isForumPanelOpen && unconfirmedSession;
  const canShowSuggestions = !isAccountFrozen && !isForumPanelOpen && !unconfirmedSession && promoData;
  const canShowGiftAuctions = !isAccountFrozen && !isForumPanelOpen;

  useSignalEffect(() => {
    // Keep in sync with the order of the panes in the DOM
    const stateArray = [
      getPlayerState(),
      getFrozenAccountState(),
      getUnconfirmedSessionState(),
      getGiftAuctionState(),
      getSuggestionState(),
    ];

    const totalHeight = stateArray.reduce((acc, state) => acc + state.height, 0);

    onHeightChange(totalHeight ? totalHeight + BOTTOM_MARGIN : 0);

    const container = ref.current;
    const writeToken = ++visualTokenRef.current;
    commitInMutatePhase(() => {
      if (visualTokenRef.current !== writeToken) return;
      if (totalHeight > 0) {
        const isIslandHidden = Boolean(container?.classList.contains(styles.rootHidden));
        const noTransition = isIslandHidden || performance.now() < suppressRowAnimationsUntilRef.current;
        applyAnimationState({ list: stateArray, noTransition, gapPx: 0 });
      }
      if (container) {
        transitionIslandVisual({
          container,
          toHeight: totalHeight,
          shouldGlide: true,
          hiddenClassName: styles.rootHidden,
          suppressRowAnimationsUntilRef,
          isCanceled: () => visualTokenRef.current !== writeToken,
        });
      }
    });
  }, [
    getPlayerState, getFrozenAccountState, getUnconfirmedSessionState, getGiftAuctionState, getSuggestionState,
  ]);

  return (
    <div
      ref={ref}
      className={
        buildClassName(
          'ChatListPanes',
          styles.root,
          className,
        )
      }
    >
      {(isMobile || isTablet) && (
        <AudioPlayer
          isCompact
          onPaneStateChange={setPlayerState}
        />
      )}
      {!noBanners && (
        <>
          <FrozenAccountPane
            isAccountFrozen={isAccountFrozen}
            onPaneStateChange={setFrozenAccountState}
          />
          <UnconfirmedSessionPane
            unconfirmedSession={canShowUnconfirmedSession ? unconfirmedSession : undefined}
            onPaneStateChange={setUnconfirmedSessionState}
          />
          <GiftAuctionPane
            canShow={canShowGiftAuctions}
            onPaneStateChange={setGiftAuctionState}
          />
          <SuggestionPane
            promoData={canShowSuggestions ? promoData : undefined}
            onPaneStateChange={setSuggestionState}
          />
        </>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      isForumPanelOpen: selectIsForumPanelOpen(global),
      sessions: global.activeSessions.byHash,
      promoData: global.promoData,
      isAccountFrozen: selectIsCurrentUserFrozen(global),
    };
  },
)(ChatListPanes));
