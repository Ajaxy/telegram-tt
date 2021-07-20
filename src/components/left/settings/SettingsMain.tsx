import React, { FC, memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { SettingsScreens } from '../../../types';
import { ApiUser } from '../../../api/types';

import { selectUser } from '../../../modules/selectors';
import { getUserFullName } from '../../../modules/helpers';
import { formatPhoneNumberWithCode } from '../../../util/phoneNumber';
import renderText from '../../common/helpers/renderText';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';

import ListItem from '../../ui/ListItem';
import Avatar from '../../common/Avatar';

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps = {
  currentUser?: ApiUser;
};

const SettingsMain: FC<OwnProps & StateProps> = ({
  isActive,
  onScreenSelect,
  onReset,
  currentUser,
}) => {
  const lang = useLang();
  const fullName = getUserFullName(currentUser);

  useHistoryBack(isActive, onReset, onScreenSelect, SettingsScreens.Main);

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-main-menu">
        {currentUser && (
          <div className="settings-current-user">
            <Avatar user={currentUser} size="jumbo" />
            <p className="name">{fullName && renderText(fullName)}</p>
            <p className="phone">{formatPhoneNumberWithCode(currentUser.phoneNumber)}</p>
          </div>
        )}
        <ListItem
          icon="edit"
          onClick={() => onScreenSelect(SettingsScreens.EditProfile)}
        >
          {lang('lng_settings_information')}
        </ListItem>
        <ListItem
          icon="folder"
          onClick={() => onScreenSelect(SettingsScreens.Folders)}
        >
          {lang('Filters')}
        </ListItem>
        <ListItem
          icon="settings"
          onClick={() => onScreenSelect(SettingsScreens.General)}
        >
          {lang('Telegram.GeneralSettingsViewController')}
        </ListItem>
        <ListItem
          icon="unmute"
          onClick={() => onScreenSelect(SettingsScreens.Notifications)}
        >
          {lang('Notifications')}
        </ListItem>
        <ListItem
          icon="lock"
          onClick={() => onScreenSelect(SettingsScreens.Privacy)}
        >
          {lang('PrivacySettings')}
        </ListItem>
        <ListItem
          icon="language"
          onClick={() => onScreenSelect(SettingsScreens.Language)}
        >
          {lang('Language')}
        </ListItem>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { currentUserId } = global;

    return {
      currentUser: currentUserId ? selectUser(global, currentUserId) : undefined,
    };
  },
)(SettingsMain));
