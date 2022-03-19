import React, {
  FC, memo, useCallback, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import { GlobalState } from '../../../global/types';
import { ApiPrivacySettings, SettingsScreens } from '../../../types';

import { ALL_FOLDER_ID, ARCHIVED_FOLDER_ID } from '../../../config';
import { unique } from '../../../util/iteratees';
import { filterChatsByName, isChatGroup, isUserId } from '../../../global/helpers';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';
import { useFolderManagerForOrderedIds } from '../../../hooks/useFolderManager';
import { getPrivacyKey } from './helper/privacy';

import Picker from '../../common/Picker';
import FloatingActionButton from '../../ui/FloatingActionButton';

export type OwnProps = {
  isAllowList?: boolean;
  screen: SettingsScreens;
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps = {
  currentUserId?: string;
  settings?: ApiPrivacySettings;
};

const SettingsPrivacyVisibilityExceptionList: FC<OwnProps & StateProps> = ({
  isAllowList,
  screen,
  isActive,
  onScreenSelect,
  onReset,
  currentUserId,
  settings,
}) => {
  const { setPrivacySettings } = getActions();

  const lang = useLang();

  const selectedContactIds = useMemo(() => {
    if (!settings) {
      return [];
    }

    if (isAllowList) {
      return [...settings.allowUserIds, ...settings.allowChatIds];
    } else {
      return [...settings.blockUserIds, ...settings.blockChatIds];
    }
  }, [isAllowList, settings]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSubmitShown, setIsSubmitShown] = useState<boolean>(false);
  const [newSelectedContactIds, setNewSelectedContactIds] = useState<string[]>(selectedContactIds);

  const folderAllOrderedIds = useFolderManagerForOrderedIds(ALL_FOLDER_ID);
  const folderArchivedOrderedIds = useFolderManagerForOrderedIds(ARCHIVED_FOLDER_ID);
  const displayedIds = useMemo(() => {
    // No need for expensive global updates on chats, so we avoid them
    const chatsById = getGlobal().chats.byId;

    const chatIds = unique([...folderAllOrderedIds || [], ...folderArchivedOrderedIds || []])
      .filter((chatId) => {
        const chat = chatsById[chatId];
        return chat && ((isUserId(chat.id) && chat.id !== currentUserId) || isChatGroup(chat));
      });

    return unique([
      ...selectedContactIds,
      ...filterChatsByName(lang, chatIds, chatsById, searchQuery),
    ]);
  }, [folderAllOrderedIds, folderArchivedOrderedIds, selectedContactIds, lang, searchQuery, currentUserId]);

  const handleSelectedContactIdsChange = useCallback((value: string[]) => {
    setNewSelectedContactIds(value);
    setIsSubmitShown(true);
  }, []);

  const handleSubmit = useCallback(() => {
    setPrivacySettings({
      privacyKey: getPrivacyKey(screen),
      isAllowList: Boolean(isAllowList),
      contactsIds: newSelectedContactIds,
    });

    onScreenSelect(SettingsScreens.Privacy);
  }, [isAllowList, newSelectedContactIds, onScreenSelect, screen, setPrivacySettings]);

  useHistoryBack(isActive, onReset, onScreenSelect, screen);

  return (
    <div className="NewChat-inner step-1">
      <Picker
        itemIds={displayedIds || []}
        selectedIds={newSelectedContactIds}
        filterValue={searchQuery}
        filterPlaceholder={isAllowList ? lang('AlwaysShareWithPlaceholder') : lang('NeverShareWithPlaceholder')}
        searchInputId="new-group-picker-search"
        onSelectedIdsChange={handleSelectedContactIdsChange}
        onFilterChange={setSearchQuery}
      />

      <FloatingActionButton
        isShown={isSubmitShown}
        onClick={handleSubmit}
        ariaLabel={isAllowList ? lang('AlwaysShareWithTitle') : lang('NeverShareWithTitle')}
      >
        <i className="icon-arrow-right" />
      </FloatingActionButton>
    </div>
  );
};

function getCurrentPrivacySettings(global: GlobalState, screen: SettingsScreens) {
  const { privacy } = global.settings;
  switch (screen) {
    case SettingsScreens.PrivacyPhoneNumberAllowedContacts:
    case SettingsScreens.PrivacyPhoneNumberDeniedContacts:
      return privacy.phoneNumber;
    case SettingsScreens.PrivacyLastSeenAllowedContacts:
    case SettingsScreens.PrivacyLastSeenDeniedContacts:
      return privacy.lastSeen;
    case SettingsScreens.PrivacyProfilePhotoAllowedContacts:
    case SettingsScreens.PrivacyProfilePhotoDeniedContacts:
      return privacy.profilePhoto;
    case SettingsScreens.PrivacyForwardingAllowedContacts:
    case SettingsScreens.PrivacyForwardingDeniedContacts:
      return privacy.forwards;
    case SettingsScreens.PrivacyGroupChatsDeniedContacts:
    case SettingsScreens.PrivacyGroupChatsAllowedContacts:
      return privacy.chatInvite;
  }

  return undefined;
}

export default memo(withGlobal<OwnProps>(
  (global, { screen }): StateProps => {
    return {
      currentUserId: global.currentUserId,
      settings: getCurrentPrivacySettings(global, screen),
    };
  },
)(SettingsPrivacyVisibilityExceptionList));
