import { memo, useMemo, useRef, useSignal } from '@teact';
import { setExtraStyles } from '@teact/teact-dom';
import { withGlobal } from '../../../../global';

import type { ApiPromoData, ApiSession } from '../../../../api/types';

import { FRESH_AUTH_PERIOD } from '../../../../config';
import { requestMutation } from '../../../../lib/fasterdom/fasterdom';
import { selectIsCurrentUserFrozen } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { getServerTime } from '../../../../util/serverTime';
import { REM } from '../../../common/helpers/mediaDimensions';

import useEffectOnce from '../../../../hooks/useEffectOnce';
import useShowTransition from '../../../../hooks/useShowTransition';
import { useSignalEffect } from '../../../../hooks/useSignalEffect';
import { applyAnimationState, type PaneState } from '../../../middle/hooks/useHeaderPane';

import FrozenAccountPane from './FrozenAccountPane';
import SuggestionPane from './SuggestionPane';
import UnconfirmedSessionPane from './UnconfirmedSessionPane';

import styles from './ChatListPanes.module.scss';

type OwnProps = {
  className?: string;
  onHeightChange: (height: number) => void;
};

type StateProps = {
  sessions: Record<string, ApiSession>;
  promoData?: ApiPromoData;
  isAccountFrozen?: boolean;
};

const TOP_MARGIN = 0.5 * REM;
const BOTTOM_MARGIN = 0.25 * REM;
const FALLBACK_PANE_STATE = { height: 0 };

const ChatListPanes = ({
  className,
  sessions,
  promoData,
  isAccountFrozen,
  onHeightChange,
}: OwnProps & StateProps) => {
  const [getUnconfirmedSessionHeight, setUnconfirmedSessionHeight] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getFrozenAccountState, setFrozenAccountState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getSuggestionState, setSuggestionState] = useSignal<PaneState>(FALLBACK_PANE_STATE);

  const isFirstRenderRef = useRef(true);
  const {
    shouldRender,
    ref,
  } = useShowTransition({
    isOpen: true,
    withShouldRender: true,
    noMountTransition: true,
  });

  useEffectOnce(() => {
    isFirstRenderRef.current = false;
  });

  const unconfirmedSession = useMemo(() => {
    const sessionsArray = Object.values(sessions || {});
    const current = sessionsArray.find((session) => session.isCurrent);
    if (!current || getServerTime() - current.dateCreated < FRESH_AUTH_PERIOD) return undefined;

    return sessionsArray.find((session) => session.isUnconfirmed);
  }, [sessions]);

  const canShowUnconfirmedSession = !isAccountFrozen && unconfirmedSession;
  const canShowSuggestions = !isAccountFrozen && !unconfirmedSession && promoData;

  useSignalEffect(() => {
    const unconfirmedSessionHeight = getUnconfirmedSessionHeight();
    const frozenAccountHeight = getFrozenAccountState();
    const suggestionHeight = getSuggestionState();

    // Keep in sync with the order of the panes in the DOM
    const stateArray = [unconfirmedSessionHeight, frozenAccountHeight, suggestionHeight];

    const isFirstRender = isFirstRenderRef.current;
    const panelsHeight = stateArray.reduce((acc, state) => acc + state.height, 0);
    const totalHeight = panelsHeight ? panelsHeight + BOTTOM_MARGIN : 0;

    onHeightChange(totalHeight);

    const leftColumn = document.getElementById('LeftColumn');
    if (!leftColumn) return;

    applyAnimationState({
      list: stateArray,
      noTransition: isFirstRender,
      topMargin: TOP_MARGIN,
      zIndexIncrease: true,
    });

    requestMutation(() => {
      setExtraStyles(leftColumn, {
        '--chat-list-panes-height': `${totalHeight}px`,
      });
    });
  }, [getUnconfirmedSessionHeight, getFrozenAccountState, getSuggestionState]);

  if (!shouldRender) return undefined;

  return (
    <div
      ref={ref}
      className={
        buildClassName(
          styles.root,
          className,
        )
      }
    >
      <FrozenAccountPane
        isAccountFrozen={isAccountFrozen}
        onPaneStateChange={setFrozenAccountState}
      />
      <UnconfirmedSessionPane
        unconfirmedSession={canShowUnconfirmedSession ? unconfirmedSession : undefined}
        onPaneStateChange={setUnconfirmedSessionHeight}
      />
      <SuggestionPane
        promoData={canShowSuggestions ? promoData : undefined}
        onPaneStateChange={setSuggestionState}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      sessions: global.activeSessions.byHash,
      promoData: global.promoData,
      isAccountFrozen: selectIsCurrentUserFrozen(global),
    };
  },
)(ChatListPanes));
