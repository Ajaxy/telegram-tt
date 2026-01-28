import { memo } from '@teact';
import { getActions, withGlobal } from '../../../../global';
import {
  selectTelebizSettingsIsLoading,
  selectTelebizUserSettings,
} from '../../../global';

import type { UserSettings } from '../../../services/types';
import { TelebizFeatureSection } from '../../../global/types';

import buildClassName from '../../../../util/buildClassName';

import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Checkbox from '../../../../components/ui/Checkbox';
import ShieldWarningFill from '../../icons/ShieldWarningFill';

import styles from './Activities.module.scss';

type StateProps = {
  userSettings?: UserSettings;
  isLoading: boolean;
};

const TelebizActivities = ({
  userSettings,
  isLoading,
}: StateProps) => {
  const { updateTelebizUserSettings, telebizOpenFeaturesModal } = getActions();

  const lang = useTelebizLang();

  const handleSyncGroupsChange = useLastCallback((checked: boolean) => {
    updateTelebizUserSettings({ sync_groups: checked });
  });

  const handleSyncPrivateChatsChange = useLastCallback((checked: boolean) => {
    updateTelebizUserSettings({ sync_private_chats: checked });
  });

  const syncGroups = userSettings?.sync_groups ?? true;
  const syncPrivateChats = userSettings?.sync_private_chats ?? true;

  return (
    <div className="settings-content no-border custom-scroll">
      <div className={styles.Activities} id="telebiz-activities">
        <div className="settings-item">
          <h4 className="settings-item-header">
            {lang('TelebizActivities.ChatActivitiesSync')}
          </h4>
          <p className="settings-item-description pt-1">
            Sync your last activity with telebiz to get notifications for inactivity and CRM updates.
            {' '}
            <a
              className="text-entity-link"
              onClick={() => telebizOpenFeaturesModal({ section: TelebizFeatureSection.AutomatedFollowups })}
            >
              {lang('TelebizFeatures.LearnMoreShort')}
            </a>
          </p>
          <Checkbox
            label={lang('TelebizActivities.GroupChats')}
            subLabel={lang('TelebizActivities.SyncLastActivityOnGroupChats')}
            checked={syncGroups}
            disabled={isLoading}
            onChange={(e) => handleSyncGroupsChange(e.target.checked)}
          />
          <Checkbox
            label={lang('TelebizActivities.PrivateChats')}
            subLabel={lang('TelebizActivities.SyncLastActivityOnPrivateChats')}
            checked={syncPrivateChats}
            disabled={isLoading}
            onChange={(e) => handleSyncPrivateChatsChange(e.target.checked)}
          />
          <div className={buildClassName(styles.hint, 'mt-4')}>
            <div className={styles.hintIcon}>
              <ShieldWarningFill />
            </div>
            <div className={styles.hintText}>
              {lang('TelebizActivities.SyncLastActivityHint')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => ({
    userSettings: selectTelebizUserSettings(global),
    isLoading: selectTelebizSettingsIsLoading(global),
  }),
)(TelebizActivities));
