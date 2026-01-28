import { memo } from '@teact';
import { getActions, withGlobal } from '../../../../global';

import type { TelebizOrganizationsState } from '../../../global/types';
import { LeftColumnContent } from '../../../../types';
import { TelebizPanelScreens } from '../../right/types';
import { TelebizSettingsScreens } from '../types';

import { selectTabState } from '../../../../global/selectors';
import {
  selectIsTelebizAgentConnected,
  selectTelebizNotifications,
  selectTelebizOrganizations,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import useLastCallback from '../../../../hooks/useLastCallback';

import Button from '../../../../components/ui/Button';
import AgentMode from '../../icons/AgentMode';
import TasksIcon from '../../icons/TasksIcon';
import OrganizationSwitcher from './OrganizationSwitcher';

import styles from './TelebizDrawer.module.scss';

type StateProps = {
  organizations: TelebizOrganizationsState;
  telebizPanelScreen?: TelebizPanelScreens;
  isTelebizPanelOpen?: boolean;
  isFocusModeActive: boolean;
  focusModeChatsCount: number;
  isOpenRouterConnected: boolean;
};

const TelebizDrawer = ({
  organizations,
  telebizPanelScreen,
  isTelebizPanelOpen,
  isFocusModeActive,
  focusModeChatsCount,
  isOpenRouterConnected,
}: StateProps) => {
  const {
    openLeftColumnContent,
    openTelebizPanelScreen,
    openTelebizSettingsScreen,
    loadTelebizPendingNotifications,
  } = getActions();

  const handleTelebizClick = useLastCallback((screen: TelebizPanelScreens) => {
    openTelebizPanelScreen({ screen, shouldOpen: true });
  });

  const handleFocusModeClick = useLastCallback(() => {
    loadTelebizPendingNotifications({});
    openLeftColumnContent({ contentKey: LeftColumnContent.Telebiz });
    openTelebizSettingsScreen({ screen: TelebizSettingsScreens.FocusMode });
  });

  return (
    <div className={styles.container}>
      <OrganizationSwitcher />
      <Button
        round
        className={
          isTelebizPanelOpen && telebizPanelScreen === TelebizPanelScreens.AgentMode ? styles.active : undefined
        }
        color="translucent"
        size="smaller"
        onClick={() => handleTelebizClick(TelebizPanelScreens.AgentMode)}
        ariaLabel="AI Agent"
      >
        <AgentMode />
        {!isOpenRouterConnected && (
          <div className={buildClassName(styles.hasNotifications, styles.hasNotificationsWarning)} />
        )}
      </Button>

      <Button
        round
        color="translucent"
        size="smaller"
        onClick={handleFocusModeClick}
        ariaLabel="Tasks Mode"
      >
        <TasksIcon />
        {focusModeChatsCount > 0 && (
          <div className={styles.hasNotifications} />
        )}
      </Button>

      <Button
        round
        color="translucent"
        size="smaller"
        onClick={() => {
          openLeftColumnContent({ contentKey: LeftColumnContent.Telebiz });
          openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Main });
        }}
        ariaLabel="Settings"
        iconName="settings"
      />
    </div>
  );
};

export default memo(withGlobal((global): StateProps => {
  const tabState = selectTabState(global);
  const notificationsState = selectTelebizNotifications(global);

  return {
    organizations: selectTelebizOrganizations(global),
    telebizPanelScreen: tabState.telebizPanelScreen,
    isTelebizPanelOpen: tabState.isTelebizPanelOpen,
    isFocusModeActive: tabState.leftColumn.contentKey === LeftColumnContent.Telebiz
      && tabState.leftColumn.telebizSettingsScreen === TelebizSettingsScreens.FocusMode,
    focusModeChatsCount: notificationsState.pendingCount,
    isOpenRouterConnected: selectIsTelebizAgentConnected(global),
  };
})(TelebizDrawer));
