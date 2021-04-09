import React, {
  FC, memo, useCallback, useMemo, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions, GlobalState } from '../../../global/types';
import { ApiChat } from '../../../api/types';
import { ApiPrivacySettings, SettingsScreens } from '../../../types';

import useLang from '../../../hooks/useLang';
import { pick } from '../../../util/iteratees';
import searchWords from '../../../util/searchWords';
import { getPrivacyKey } from './helper/privacy';
import {
  getChatTitle, isChatGroup, isChatPrivate, prepareChatList,
} from '../../../modules/helpers';

import Picker from '../../common/Picker';
import FloatingActionButton from '../../ui/FloatingActionButton';

export type OwnProps = {
  isAllowList?: boolean;
  screen: SettingsScreens;
  onScreenSelect: (screen: SettingsScreens) => void;
};

type StateProps = {
  currentUserId?: number;
  chatsById: Record<number, ApiChat>;
  listIds?: number[];
  orderedPinnedIds?: number[];
  archivedListIds?: number[];
  archivedPinnedIds?: number[];
  settings?: ApiPrivacySettings;
};

type DispatchProps = Pick<GlobalActions, 'setPrivacySettings'>;

const SettingsPrivacyVisibilityExceptionList: FC<OwnProps & StateProps & DispatchProps> = ({
  currentUserId,
  isAllowList,
  screen,
  settings,
  chatsById,
  listIds,
  orderedPinnedIds,
  archivedListIds,
  archivedPinnedIds,
  setPrivacySettings,
  onScreenSelect,
}) => {
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
  const [newSelectedContactIds, setNewSelectedContactIds] = useState<number[]>(selectedContactIds);

  const chats = useMemo(() => {
    const activeChatArrays = listIds
      ? prepareChatList(chatsById, listIds, orderedPinnedIds, 'all')
      : undefined;
    const archivedChatArrays = archivedListIds
      ? prepareChatList(chatsById, archivedListIds, archivedPinnedIds, 'archived')
      : undefined;

    if (!activeChatArrays && !archivedChatArrays) {
      return undefined;
    }

    return [
      ...(activeChatArrays
        ? [
          ...activeChatArrays.pinnedChats,
          ...activeChatArrays.otherChats,
        ]
        : []
      ),
      ...(archivedChatArrays ? archivedChatArrays.otherChats : []),
    ];
  }, [chatsById, listIds, orderedPinnedIds, archivedListIds, archivedPinnedIds]);

  const displayedIds = useMemo(() => {
    if (!chats) {
      return undefined;
    }

    return chats
      .filter((chat) => (
        ((isChatPrivate(chat.id) && chat.id !== currentUserId) || isChatGroup(chat))
        && (
          !searchQuery
        || searchWords(getChatTitle(chat), searchQuery)
        || selectedContactIds.includes(chat.id)
        )
      ))
      .map(({ id }) => id);
  }, [chats, currentUserId, searchQuery, selectedContactIds]);

  const handleSelectedContactIdsChange = useCallback((value: number[]) => {
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

  const lang = useLang();

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
    const {
      chats: {
        byId: chatsById,
        listIds,
        orderedPinnedIds,
      },
      currentUserId,
    } = global;

    return {
      currentUserId,
      chatsById,
      listIds: listIds.active,
      orderedPinnedIds: orderedPinnedIds.active,
      archivedPinnedIds: orderedPinnedIds.archived,
      archivedListIds: listIds.archived,
      settings: getCurrentPrivacySettings(global, screen),
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['setPrivacySettings']),
)(SettingsPrivacyVisibilityExceptionList));
