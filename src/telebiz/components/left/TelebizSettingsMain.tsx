import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { TelebizSettingsScreens } from './types';

import { TELEBIZ_CONTACT_URL, TELEBIZ_FAQ_URL, TELEBIZ_PRIVACY_URL } from '../../config/constants';

import { useTelebizLang } from '../../hooks/useTelebizLang';

import ListItem from '../../../components/ui/ListItem';
import AgentModeOutline from '../icons/AgentModeOutline';
import Logo from '../icons/Logo';
import Template from '../icons/Template';

import styles from './TelebizSettings.module.scss';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  integrationsCount?: number;
};

const TelebizSettingsMain: FC<OwnProps & StateProps> = ({
  isActive,
  integrationsCount,
  onReset,
}) => {
  const {
    openTelebizSettingsScreen,
    openUrl,
    telebizOpenFeaturesModal,
  } = getActions();

  const lang = useTelebizLang();

  return (
    <div className="settings-fab-wrapper">
      {/* Organization Switcher at the top */}
      <div className="settings-main-menu">
        <div className="settings-content-header">
          <div className="settings-content-icon">
            <Logo />
          </div>
          <div className="settings-item-description mb-3">
            <p>Welcome to the Telebiz settings section, here you can manage your integrations and settings.</p>
          </div>
        </div>
      </div>

      <div className="settings-main-menu pr-2">
        <ListItem
          icon="group"
          narrow
          onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Organizations })}
        >
          {lang('Settings.Menu.Organizations')}
        </ListItem>
        <ListItem
          icon="link"
          narrow
          onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Integrations })}
        >
          {lang('Settings.Menu.Integrations')}
        </ListItem>
        <ListItem
          leftElement={<AgentModeOutline />}
          narrow
          buttonClassName={styles.customIconButton}
          onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.AIIntegrations })}
        >
          {lang('Settings.Menu.AI')}
        </ListItem>
        <ListItem
          icon="noise-suppression"
          narrow
          onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Activities })}
        >
          {lang('Settings.Menu.Activities')}
        </ListItem>
        <ListItem
          leftElement={<Template size={24} />}
          narrow
          buttonClassName={styles.customIconButton}
          onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.TemplatesChats })}
        >
          {lang('Settings.Menu.TemplatesChats')}
        </ListItem>
        <ListItem
          icon="schedule"
          narrow
          onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.PendingReminders })}
        >
          {lang('Settings.Menu.PendingReminders')}
        </ListItem>
      </div>
      <div className="settings-main-menu pr-2">
        <ListItem
          icon="info"
          narrow
          onClick={() => telebizOpenFeaturesModal({})}
        >
          {lang('TelebizFeatures.LearnMoreShort')}
        </ListItem>
        <ListItem
          icon="ask-support"
          narrow
          onClick={() => openUrl({ url: TELEBIZ_CONTACT_URL })}
        >
          {lang('Settings.Menu.AskAQuestion')}
        </ListItem>
        <ListItem
          icon="help"
          narrow
          onClick={() => openUrl({ url: TELEBIZ_FAQ_URL })}
        >
          {lang('Settings.Menu.Faq')}
        </ListItem>
        <ListItem
          icon="privacy-policy"
          narrow
          onClick={() => openUrl({ url: TELEBIZ_PRIVACY_URL })}
        >
          {lang('Settings.Menu.PrivacyPolicy')}
        </ListItem>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    // TODO: Replace with proper selector when telebiz state is implemented
    const integrationsCount = 0; // global.telebiz?.integrations?.length || 0;

    return {
      integrationsCount,
    };
  },
)(TelebizSettingsMain));
