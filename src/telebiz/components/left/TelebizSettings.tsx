import type { FC } from '../../../lib/teact/teact';
import { memo, useRef } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { AnimationLevel } from '../../../types/index';
import type { Organization } from '../../services/types';
import { TelebizSettingsScreens } from './types';

import { selectTelebizPendingOrganization } from '../../global/selectors';
import { resolveTransitionName } from '../../../util/resolveTransitionName';

import useLastCallback from '../../../hooks/useLastCallback';
import useScrollNotch from '../../../hooks/useScrollNotch';

import Transition from '../../../components/ui/Transition';
import FocusModeChatList from './FocusModeChatList';
import TelebizActivities from './TelebizActivities';
import TelebizIntegrations from './TelebizIntegrations';
import AIIntegrations from './TelebizIntegrations/AIIntegrations';
import ClaudeIntegration from './TelebizIntegrations/ClaudeIntegration';
import CustomSkills from './TelebizIntegrations/CustomSkills';
import GeminiIntegration from './TelebizIntegrations/GeminiIntegration';
import McpIntegration from './TelebizIntegrations/McpIntegration';
import OpenAIIntegration from './TelebizIntegrations/OpenAIIntegration';
import OpenRouterIntegration from './TelebizIntegrations/OpenRouterIntegration';
import TelebizIntegrationDetails from './TelebizIntegrations/TelebizIntegrationDetails';
import TelebizNotifications from './TelebizNotifications';
import TelebizOrganizations from './TelebizOrganizations';
import TelebizPendingReminders from './TelebizPendingReminders';
import TelebizSettingsHeader from './TelebizSettingsHeader';
import TelebizSettingsMain from './TelebizSettingsMain';
import TelebizTemplatesChats from './TelebizTemplatesChats';
import TelebizManageTemplatesChats from './TelebizTemplatesChats/ManageTemplatesChats';

import '../../../components/left/settings/Settings.scss';

const TRANSITION_RENDER_COUNT = Object.keys(TelebizSettingsScreens).length / 2;

const ALLOWED_SCREENS_TO_RETURN_TO_CHAT_LIST = [
  TelebizSettingsScreens.Main,
  TelebizSettingsScreens.Notifications,
  TelebizSettingsScreens.FocusMode,
];

export type OwnProps = {
  isActive: boolean;
  currentScreen: TelebizSettingsScreens;
  onReset: (forceReturnToChatList?: true | Event) => void;
  animationLevel: AnimationLevel;
  shouldSkipTransition: boolean;
};

type StateProps = {
  pendingOrganization?: Partial<Organization>;
};

const Settings: FC<OwnProps & StateProps> = ({
  isActive,
  currentScreen,
  animationLevel,
  shouldSkipTransition,
  onReset,
  pendingOrganization,
}) => {
  const containerRef = useRef<HTMLDivElement>();
  const isCreating = !pendingOrganization?.id;

  useScrollNotch({
    containerRef,
    selector: '.settings-content',
  }, [currentScreen]);

  const handleReset = useLastCallback((forceReturnToChatList?: true | Event) => {
    if (!ALLOWED_SCREENS_TO_RETURN_TO_CHAT_LIST.includes(currentScreen) && forceReturnToChatList !== true) {
      const { openTelebizSettingsScreen } = getActions();
      if (currentScreen === TelebizSettingsScreens.OrganizationsCreate) {
        openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Organizations });
        return;
      }
      if (currentScreen === TelebizSettingsScreens.OrganizationsAddMembers
        || currentScreen === TelebizSettingsScreens.OrganizationsPayment
      ) {
        openTelebizSettingsScreen({
          screen: isCreating ? TelebizSettingsScreens.OrganizationsCreate : TelebizSettingsScreens.OrganizationsEdit,
        });
        return;
      }
      if (currentScreen === TelebizSettingsScreens.OrganizationsEdit) {
        openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Organizations });
        return;
      }
      if (currentScreen === TelebizSettingsScreens.ManageTemplatesChats) {
        openTelebizSettingsScreen({ screen: TelebizSettingsScreens.TemplatesChats });
        return;
      }
      if (currentScreen === TelebizSettingsScreens.IntegrationDetails) {
        openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Integrations });
        return;
      }
      if (currentScreen === TelebizSettingsScreens.AIIntegrations) {
        openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Main });
        return;
      }
      if (currentScreen === TelebizSettingsScreens.OpenRouterIntegration) {
        openTelebizSettingsScreen({ screen: TelebizSettingsScreens.AIIntegrations });
        return;
      }
      if (currentScreen === TelebizSettingsScreens.ClaudeIntegration) {
        openTelebizSettingsScreen({ screen: TelebizSettingsScreens.AIIntegrations });
        return;
      }
      if (currentScreen === TelebizSettingsScreens.OpenAIIntegration) {
        openTelebizSettingsScreen({ screen: TelebizSettingsScreens.AIIntegrations });
        return;
      }
      if (currentScreen === TelebizSettingsScreens.GeminiIntegration) {
        openTelebizSettingsScreen({ screen: TelebizSettingsScreens.AIIntegrations });
        return;
      }
      if (currentScreen === TelebizSettingsScreens.CustomSkills) {
        openTelebizSettingsScreen({ screen: TelebizSettingsScreens.AIIntegrations });
        return;
      }
      if (currentScreen === TelebizSettingsScreens.McpIntegration) {
        openTelebizSettingsScreen({ screen: TelebizSettingsScreens.AIIntegrations });
        return;
      }
      openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Main });
      return;
    }

    onReset(forceReturnToChatList);
  });

  function renderCurrentSectionContent() {
    switch (currentScreen) {
      case TelebizSettingsScreens.Main:
        return (
          <TelebizSettingsMain
            isActive={isActive}
            onReset={handleReset}
          />
        );
      case TelebizSettingsScreens.Integrations:
        return (
          <TelebizIntegrations />
        );
      case TelebizSettingsScreens.AIIntegrations:
        return (
          <AIIntegrations />
        );
      case TelebizSettingsScreens.CustomSkills:
        return (
          <CustomSkills />
        );
      case TelebizSettingsScreens.Activities:
        return (
          <TelebizActivities />
        );
      case TelebizSettingsScreens.IntegrationDetails:
        return (
          <TelebizIntegrationDetails />
        );
      case TelebizSettingsScreens.OpenRouterIntegration:
        return (
          <OpenRouterIntegration />
        );
      case TelebizSettingsScreens.ClaudeIntegration:
        return (
          <ClaudeIntegration />
        );
      case TelebizSettingsScreens.OpenAIIntegration:
        return (
          <OpenAIIntegration />
        );
      case TelebizSettingsScreens.GeminiIntegration:
        return (
          <GeminiIntegration />
        );
      case TelebizSettingsScreens.McpIntegration:
        return (
          <McpIntegration />
        );
      case TelebizSettingsScreens.Organizations:
      case TelebizSettingsScreens.OrganizationsCreate:
      case TelebizSettingsScreens.OrganizationsEdit:
      case TelebizSettingsScreens.OrganizationsAddMembers:
      case TelebizSettingsScreens.OrganizationsPayment:
        return (
          <TelebizOrganizations currentScreen={currentScreen} />
        );
      case TelebizSettingsScreens.Notifications:
        return (
          <TelebizNotifications isActive={isActive} />
        );
      case TelebizSettingsScreens.TemplatesChats:
        return (
          <TelebizTemplatesChats />
        );
      case TelebizSettingsScreens.ManageTemplatesChats:
        return (
          <TelebizManageTemplatesChats />
        );
      case TelebizSettingsScreens.FocusMode:
        return (
          <FocusModeChatList isActive={isActive} onReset={handleReset} />
        );
      case TelebizSettingsScreens.PendingReminders:
        return (
          <TelebizPendingReminders isActive={isActive} />
        );
      default:
        return (
          <div className="settings-content custom-scroll">
            <div>
              Unknown screen:
              {currentScreen}
            </div>
          </div>
        );
    }
  }

  function renderCurrentSection() {
    return (
      <>
        <TelebizSettingsHeader
          currentScreen={currentScreen}
          onReset={handleReset}
        />
        {renderCurrentSectionContent()}
      </>
    );
  }

  return (
    <Transition
      ref={containerRef}
      id="TelebizSettings"
      name={resolveTransitionName('layers', animationLevel, shouldSkipTransition)}
      activeKey={currentScreen}
      renderCount={TRANSITION_RENDER_COUNT}
      shouldWrap
      withSwipeControl
    >
      {renderCurrentSection}
    </Transition>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => ({
    pendingOrganization: selectTelebizPendingOrganization(global),
  }),
)(Settings));
