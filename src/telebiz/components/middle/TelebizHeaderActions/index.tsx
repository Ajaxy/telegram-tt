import { memo, useMemo } from '@teact';
import { getActions, withGlobal } from '../../../../global';

import { TelebizPanelScreens } from '../../right/types';

import {
  selectTabState,
} from '../../../../global/selectors';
import { IS_APP } from '../../../../util/browser/windowEnvironment';

import { useHotkeys } from '../../../../hooks/useHotkeys';
import useLastCallback from '../../../../hooks/useLastCallback';

import Button from '../../../../components/ui/Button';
import TelebizCTA from '../TelebizCTA';

import styles from './TelebizHeaderActions.module.scss';

interface StateProps {
  telebizPanelScreen?: TelebizPanelScreens;
  isTelebizPanelOpen?: boolean;
}

const TelebizHeaderActions = ({ telebizPanelScreen, isTelebizPanelOpen }: StateProps) => {
  const {
    openTelebizPanelScreen,
  } = getActions();

  const handleTelebizClick = useLastCallback((screen: TelebizPanelScreens) => {
    openTelebizPanelScreen({ screen, shouldOpen: true });
  });

  const handleHotkeyTelebizMainClick = useLastCallback((e: KeyboardEvent) => {
    if (!IS_APP || e.shiftKey) {
      return;
    }

    e.preventDefault();
    openTelebizPanelScreen({ screen: TelebizPanelScreens.Main });
  });

  const handleHotkeyTelebizAgentClick = useLastCallback((e: KeyboardEvent) => {
    if (!IS_APP || e.shiftKey) {
      return;
    }

    e.preventDefault();
    openTelebizPanelScreen({ screen: TelebizPanelScreens.AgentMode });
  });

  useHotkeys(useMemo(() => ({
    'Mod+.': handleHotkeyTelebizAgentClick,
    'Mod+/': handleHotkeyTelebizMainClick,
  }), []));

  return (
    <>
      <Button
        round
        className={
          isTelebizPanelOpen && telebizPanelScreen === TelebizPanelScreens.Main ? styles.active : undefined
        }
        color="translucent"
        size="smaller"
        onClick={() => handleTelebizClick(TelebizPanelScreens.Main)}
        ariaLabel="Telebiz"
      >
        <TelebizCTA />
      </Button>
    </>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const tabState = selectTabState(global);
    return {
      telebizPanelScreen: tabState.telebizPanelScreen,
      isTelebizPanelOpen: tabState.isTelebizPanelOpen,
    };
  },
)(TelebizHeaderActions));
