import type { ActionReturnType } from '../../../../global/types';
import { LeftColumnContent } from '../../../../types';
import { TelebizSettingsScreens } from '../../../components/left/types';
import { TelebizPanelScreens } from '../../../components/right/types';

import { addActionHandler } from '../../../../global/index';
import { updateTabState } from '../../../../global/reducers/tabs';
import { selectTabState } from '../../../../global/selectors';
import { getCurrentTabId } from '../../../../util/establishMultitabRole';

addActionHandler('toggleTelebizPanel', (global, actions, payload): ActionReturnType => {
  const { force, tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);

  const isCurrentlyOpen = tabState.isTelebizPanelOpen;
  const shouldOpen = force !== undefined ? force : !isCurrentlyOpen;

  global = { ...global, lastIsTelebizPanelOpen: shouldOpen, lastTelebizPanelScreen: TelebizPanelScreens.Main };

  return updateTabState(global, {
    isTelebizPanelOpen: shouldOpen,
    telebizPanelScreen: TelebizPanelScreens.Main,
  }, tabId);
});

addActionHandler('openTelebizPanelScreen', (global, actions, payload): ActionReturnType => {
  const { screen = TelebizPanelScreens.Main, tabId = getCurrentTabId(), shouldOpen = true } = payload;
  const tabState = selectTabState(global, tabId);

  global = { ...global, lastIsTelebizPanelOpen: shouldOpen, lastTelebizPanelScreen: screen };

  return updateTabState(global, {
    telebizPanelScreen: screen,
    ...(!tabState?.isTelebizPanelOpen && {
      isTelebizPanelOpen: shouldOpen,
    }),
  }, tabId);
});

addActionHandler('openTelebizSettingsScreen', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload;
  const tabState = selectTabState(global, tabId);

  // Force telebiz settings only if new screen is passed, do not on resets
  if (payload.screen) actions.openLeftColumnContent({ contentKey: LeftColumnContent.Telebiz, tabId });

  // Always reset to Main screen when opening Telebiz settings, unless a specific screen is requested
  const targetScreen = payload.screen || TelebizSettingsScreens.Main;

  return updateTabState(global, {
    leftColumn: {
      ...tabState.leftColumn,
      telebizSettingsScreen: targetScreen,
    },
  }, tabId);
});
