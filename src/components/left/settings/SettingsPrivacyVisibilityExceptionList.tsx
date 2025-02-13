import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiPrivacySettings } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { CustomPeerType, UniqueCustomPeer } from '../../../types';
import { SettingsScreens } from '../../../types';

import { ALL_FOLDER_ID, ARCHIVED_FOLDER_ID, SERVICE_NOTIFICATIONS_USER_ID } from '../../../config';
import {
  isChatChannel, isDeletedUser,
} from '../../../global/helpers';
import { filterPeersByQuery } from '../../../global/helpers/peers';
import { unique } from '../../../util/iteratees';
import { CUSTOM_PEER_PREMIUM } from '../../../util/objects/customPeer';
import { getPrivacyKey } from './helpers/privacy';

import { useFolderManagerForOrderedIds } from '../../../hooks/useFolderManager';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
import PeerPicker from '../../common/pickers/PeerPicker';
import FloatingActionButton from '../../ui/FloatingActionButton';

export type OwnProps = {
  isAllowList?: boolean;
  withPremiumCategory?: boolean;
  withMiniAppsCategory?: boolean;
  screen: SettingsScreens;
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps = {
  currentUserId?: string;
  settings?: ApiPrivacySettings;
};

const PREMIUM_CATEGORY = [CUSTOM_PEER_PREMIUM];

const SettingsPrivacyVisibilityExceptionList: FC<OwnProps & StateProps> = ({
  isAllowList,
  withPremiumCategory,
  withMiniAppsCategory,
  screen,
  isActive,
  currentUserId,
  settings,
  onScreenSelect,
  onReset,
}) => {
  const { setPrivacySettings } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();

  const customPeerBots : UniqueCustomPeer = useMemo(() => {
    return {
      isCustomPeer: true,
      type: 'bots',
      title: lang('PrivacyValueBots'),
      avatarIcon: 'bots',
      isAvatarSquare: true,
      peerColorId: 6,
    };
  }, [lang]);

  const miniAppsCategory = useMemo(() => {
    return [customPeerBots];
  }, [customPeerBots]);

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
  const selectedCategoryTypes = useMemo(() => {
    if (!settings) {
      return [];
    }
    if (settings.shouldAllowPremium) { return [CUSTOM_PEER_PREMIUM.type]; }
    if (settings.botsPrivacy === 'allow' && isAllowList) { return [customPeerBots.type]; }
    return [];
  }, [settings, isAllowList, customPeerBots]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSubmitShown, setIsSubmitShown] = useState<boolean>(false);
  const [newSelectedContactIds, setNewSelectedContactIds] = useState<string[]>(selectedContactIds);
  const [newSelectedCategoryTypes, setNewSelectedCategoryTypes] = useState<CustomPeerType[]>(selectedCategoryTypes);

  // Reset selected contact ids on change from other client when screen is not active
  useEffect(() => {
    if (!isActive) {
      setNewSelectedContactIds(selectedContactIds);
      setNewSelectedCategoryTypes(selectedCategoryTypes);
    }
  }, [isActive, selectedCategoryTypes, selectedContactIds]);

  const folderAllOrderedIds = useFolderManagerForOrderedIds(ALL_FOLDER_ID);
  const folderArchivedOrderedIds = useFolderManagerForOrderedIds(ARCHIVED_FOLDER_ID);
  const displayedIds = useMemo(() => {
    // No need for expensive global updates on chats, so we avoid them
    const chatsById = getGlobal().chats.byId;
    const usersById = getGlobal().users.byId;

    const chatIds = unique([...folderAllOrderedIds || [], ...folderArchivedOrderedIds || []])
      .filter((chatId) => {
        const chat = chatsById[chatId];
        const user = usersById[chatId];
        const isDeleted = user && isDeletedUser(user);
        const isChannel = chat && isChatChannel(chat);
        return chatId !== currentUserId && chatId !== SERVICE_NOTIFICATIONS_USER_ID && !isChannel && !isDeleted;
      });

    const filteredChats = filterPeersByQuery({ ids: chatIds, query: searchQuery });

    // Show only relevant items
    if (searchQuery) return filteredChats;

    return unique([
      ...selectedContactIds,
      ...chatIds,
    ]);
  }, [folderAllOrderedIds, folderArchivedOrderedIds, selectedContactIds, searchQuery, currentUserId]);

  const handleSelectedCategoriesChange = useCallback((value: CustomPeerType[]) => {
    setNewSelectedCategoryTypes(value);
    setIsSubmitShown(true);
  }, []);

  const handleSelectedContactIdsChange = useCallback((value: string[]) => {
    setNewSelectedContactIds(value);
    setIsSubmitShown(true);
  }, []);

  const handleSubmit = useCallback(() => {
    setPrivacySettings({
      privacyKey: getPrivacyKey(screen)!,
      isAllowList: Boolean(isAllowList),
      updatedIds: newSelectedContactIds,
      isPremiumAllowed: newSelectedCategoryTypes.includes(CUSTOM_PEER_PREMIUM.type) || undefined,
      botsPrivacy: (!withMiniAppsCategory) ? 'none'
        : (newSelectedCategoryTypes.includes(customPeerBots.type) ? 'allow' : 'disallow'),
    });

    onScreenSelect(SettingsScreens.Privacy);
  }, [
    isAllowList,
    withMiniAppsCategory,
    newSelectedCategoryTypes,
    newSelectedContactIds,
    onScreenSelect,
    screen,
    customPeerBots,
  ]);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  function getCustomCategory() {
    if (withPremiumCategory) return PREMIUM_CATEGORY;
    if (withMiniAppsCategory && isAllowList) return miniAppsCategory;
    return undefined;
  }

  return (
    <div className="NewChat-inner step-1">
      <PeerPicker
        categories={getCustomCategory()}
        itemIds={displayedIds || []}
        selectedIds={newSelectedContactIds}
        selectedCategories={newSelectedCategoryTypes}
        filterValue={searchQuery}
        filterPlaceholder={isAllowList ? oldLang('AlwaysAllowPlaceholder') : oldLang('NeverAllowPlaceholder')}
        categoryPlaceholderKey="PrivacyUserTypes"
        searchInputId="new-group-picker-search"
        isSearchable
        onSelectedIdsChange={handleSelectedContactIdsChange}
        onSelectedCategoriesChange={handleSelectedCategoriesChange}
        onFilterChange={setSearchQuery}
        allowMultiple
        itemInputType="checkbox"
        withDefaultPadding
        withStatus
      />

      <FloatingActionButton
        isShown={isSubmitShown}
        onClick={handleSubmit}
        ariaLabel={isAllowList ? oldLang('AlwaysAllow') : oldLang('NeverAllow')}
      >
        <Icon name="check" />
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
    case SettingsScreens.PrivacyBioAllowedContacts:
    case SettingsScreens.PrivacyBioDeniedContacts:
      return privacy.bio;
    case SettingsScreens.PrivacyBirthdayAllowedContacts:
    case SettingsScreens.PrivacyBirthdayDeniedContacts:
      return privacy.birthday;
    case SettingsScreens.PrivacyGiftsAllowedContacts:
    case SettingsScreens.PrivacyGiftsDeniedContacts:
      return privacy.gifts;
    case SettingsScreens.PrivacyPhoneCallAllowedContacts:
    case SettingsScreens.PrivacyPhoneCallDeniedContacts:
      return privacy.phoneCall;
    case SettingsScreens.PrivacyPhoneP2PAllowedContacts:
    case SettingsScreens.PrivacyPhoneP2PDeniedContacts:
      return privacy.phoneP2P;
    case SettingsScreens.PrivacyForwardingAllowedContacts:
    case SettingsScreens.PrivacyForwardingDeniedContacts:
      return privacy.forwards;
    case SettingsScreens.PrivacyVoiceMessagesAllowedContacts:
    case SettingsScreens.PrivacyVoiceMessagesDeniedContacts:
      return privacy.voiceMessages;
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
