import { memo, useCallback, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { Organization, Provider } from '../../services/types';
import { TelebizSettingsScreens } from './types';

import {
  selectTelebizPendingOrganization,
  selectTelebizProviders,
  selectTelebizSelectedProviderName,
} from '../../global/selectors';

import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import DropdownMenu from '../../../components/ui/DropdownMenu';
import MenuItem from '../../../components/ui/MenuItem';
import HeaderMenuButton from '../common/HeaderMenuButton';
import TelebizNotificationsHeader from './TelebizNotifications/TelebizNotificationsHeader';

type OwnProps = {
  currentScreen: TelebizSettingsScreens;
  onReset: () => void;
};

type StateProps = {
  pendingOrganization?: Partial<Organization>;
  providers: Provider[];
  selectedProviderName?: string;
};

const TelebizSettingsHeader = ({
  currentScreen,
  onReset,
  pendingOrganization,
  providers,
  selectedProviderName,
}: OwnProps & StateProps) => {
  const {
    openTelebizSettingsScreen,
    deleteTelebizOrganization,
  } = getActions();

  const [isDeleteOrganizationModalOpen, setIsDeleteOrganizationModalOpen] = useState<boolean>(false);

  const selectedProvider = providers.find((p) => p.name === selectedProviderName);

  const openDeleteOrganizationConfirmation = useCallback(() => {
    setIsDeleteOrganizationModalOpen(true);
  }, []);

  const closeDeleteOrganizationConfirmation = useCallback(() => {
    setIsDeleteOrganizationModalOpen(false);
  }, []);

  const handleDeleteOrganization = useCallback(() => {
    if (!pendingOrganization?.id) return;
    deleteTelebizOrganization({ organizationId: pendingOrganization.id });
    closeDeleteOrganizationConfirmation();
    openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Organizations });
  }, [closeDeleteOrganizationConfirmation, pendingOrganization, deleteTelebizOrganization, openTelebizSettingsScreen]);

  function renderHeaderContent() {
    switch (currentScreen) {
      case TelebizSettingsScreens.Main:
        return <h3>Telebiz Settings</h3>;
      case TelebizSettingsScreens.Integrations:
        return <h3>Integrations</h3>;
      case TelebizSettingsScreens.AIIntegrations:
        return <h3>AI</h3>;
      case TelebizSettingsScreens.CustomSkills:
        return <h3>Custom Skills</h3>;
      case TelebizSettingsScreens.Activities:
        return <h3>Activities</h3>;
      case TelebizSettingsScreens.IntegrationDetails:
        return <h3>{selectedProvider?.display_name || 'Integration'}</h3>;
      case TelebizSettingsScreens.OpenRouterIntegration:
        return <h3>OpenRouter</h3>;
      case TelebizSettingsScreens.ClaudeIntegration:
        return <h3>Claude</h3>;
      case TelebizSettingsScreens.OpenAIIntegration:
        return <h3>OpenAI</h3>;
      case TelebizSettingsScreens.GeminiIntegration:
        return <h3>Google Gemini</h3>;
      case TelebizSettingsScreens.McpIntegration:
        return <h3>Local MCP</h3>;
      case TelebizSettingsScreens.Organizations:
        return <h3>Organizations</h3>;
      case TelebizSettingsScreens.OrganizationsCreate:
        return <h3>Create Organization</h3>;
      case TelebizSettingsScreens.OrganizationsEdit:
        return (
          <div className="settings-main-header">
            <h3>Edit Organization</h3>
            <DropdownMenu
              className="settings-more-menu"
              trigger={HeaderMenuButton}
              positionX="right"
            >
              <MenuItem icon="delete" destructive onClick={openDeleteOrganizationConfirmation}>
                Delete
              </MenuItem>
            </DropdownMenu>
          </div>
        );
      case TelebizSettingsScreens.OrganizationsAddMembers:
        return <h3>Add Members</h3>;
      case TelebizSettingsScreens.OrganizationsPayment:
        return <h3>Payment</h3>;
      case TelebizSettingsScreens.TemplatesChats:
        return <h3>Templates</h3>;
      case TelebizSettingsScreens.ManageTemplatesChats:
        return <h3>Manage Chats</h3>;
      case TelebizSettingsScreens.Notifications:
        return <TelebizNotificationsHeader />;
      case TelebizSettingsScreens.FocusMode:
        return <h3>Tasks Mode</h3>;
      case TelebizSettingsScreens.PendingReminders:
        return <h3>Pending Reminders</h3>;
      default:
        return <h3>Telebiz Settings</h3>;
    }
  }

  return (
    <div className="left-header">
      <Button
        round
        size="smaller"
        color="translucent"
        onClick={onReset}
        iconName="arrow-left"
      />
      {renderHeaderContent()}
      <ConfirmDialog
        isOpen={isDeleteOrganizationModalOpen}
        onClose={closeDeleteOrganizationConfirmation}
        confirmIsDestructive
        confirmHandler={handleDeleteOrganization}
        text="Are you sure you want to delete this organization?"
        confirmLabel="Delete"
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => ({
    pendingOrganization: selectTelebizPendingOrganization(global),
    providers: selectTelebizProviders(global),
    selectedProviderName: selectTelebizSelectedProviderName(global),
  }),
)(TelebizSettingsHeader));
