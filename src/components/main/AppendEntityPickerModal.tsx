import type { FC } from '../../lib/teact/teact';
import React, {
  memo,
  useMemo,
  useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiChat, ApiChatMember, ApiUserStatus } from '../../api/types';

import {
  filterChatsByName,
  filterUsersByName, isChatChannel, isChatPublic, isChatSuperGroup, isUserBot, sortUserIds,
} from '../../global/helpers';
import { selectChat, selectChatFullInfo } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { unique } from '../../util/iteratees';
import sortChatIds from '../common/helpers/sortChatIds';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Icon from '../common/Icon';
import Picker from '../common/Picker';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import Modal from '../ui/Modal';

import styles from './AppendEntityPicker.module.scss';

export type OwnProps = {
  isOpen?: boolean;
  onClose: () => void;
  chatId?: string;
  entityType: 'members' | 'channels' | undefined;
  onSubmit: (value: string[]) => void;
  selectionLimit: number;
};

interface StateProps {
  chatId?: string;
  members?: ApiChatMember[];
  adminMembersById?: Record<string, ApiChatMember>;
  userStatusesById: Record<string, ApiUserStatus>;
  channelList?: (ApiChat | undefined)[] | undefined;
  isChannel?: boolean;
  isSuperGroup?: boolean;
  currentUserId?: string | undefined;
}

const AppendEntityPickerModal: FC<OwnProps & StateProps> = ({
  chatId,
  isOpen,
  onClose,
  members,
  adminMembersById,
  userStatusesById,
  entityType,
  isChannel,
  isSuperGroup,
  onSubmit,
  currentUserId,
  selectionLimit,
}) => {
  const { showNotification } = getActions();

  const lang = useLang();
  const [isConfirmModalOpen, openConfirmModal, closeConfirmModal] = useFlag();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingChannelId, setPendingChannelId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const channelsIds = useMemo(() => {
    const chatsById = getGlobal().chats.byId;
    const activeChatIds = getGlobal().chats.listIds.active;

    return activeChatIds!.map((id) => chatsById[id])
      .filter((chat) => chat && (isChatChannel(chat)
        || isChatSuperGroup(chat)) && chat.id !== chatId)
      .map((chat) => chat!.id);
  }, [chatId]);

  const adminIds = useMemo(() => {
    return adminMembersById && Object.keys(adminMembersById);
  }, [adminMembersById]);

  const memberIds = useMemo(() => {
    const usersById = getGlobal().users.byId;
    if (!members || !usersById) {
      return [];
    }

    const userIds = sortUserIds(
      members.map(({ userId }) => userId),
      usersById,
      userStatusesById,
    );

    return adminIds ? userIds.filter((userId) => userId !== currentUserId) : userIds;
  }, [adminIds, currentUserId, members, userStatusesById]);

  const displayedMembersIds = useMemo(() => {
    const usersById = getGlobal().users.byId;
    const filteredContactIds = memberIds ? filterUsersByName(memberIds, usersById, searchQuery) : [];

    return sortChatIds(unique(filteredContactIds).filter((userId) => {
      const user = usersById[userId];
      if (!user) {
        return true;
      }

      return !isUserBot(user);
    }));
  }, [memberIds, searchQuery]);

  const displayedChannelIds = useMemo(() => {
    const chatsById = getGlobal().chats.byId;
    const foundChannelIds = channelsIds ? filterChatsByName(lang, channelsIds, chatsById, searchQuery) : [];

    return sortChatIds(unique(foundChannelIds).filter((contactId) => {
      const chat = chatsById[contactId];
      if (!chat) {
        return true;
      }

      return isChannel || isSuperGroup;
    }),
    false,
    selectedIds);
  }, [channelsIds, lang, searchQuery, selectedIds, isSuperGroup, isChannel]);

  const handleCloseButtonClick = useLastCallback(() => {
    onSubmit([]);
    onClose();
  });

  const handleSendIdList = useLastCallback(() => {
    onSubmit(selectedIds);
    onClose();
  });

  const confirmPrivateLinkChannelSelection = useLastCallback(() => {
    if (pendingChannelId) {
      setSelectedIds((prevIds) => unique([...prevIds, pendingChannelId]));
    }
    closeConfirmModal();
  });

  const handleSelectedMemberIdsChange = useLastCallback((newSelectedIds: string[]) => {
    if (newSelectedIds.length > selectionLimit) {
      showNotification({
        message: lang('BoostingSelectUpToWarningUsers', selectionLimit),
      });
      return;
    }
    setSelectedIds(newSelectedIds);
  });

  const handleSelectedChannelIdsChange = useLastCallback((newSelectedIds: string[]) => {
    const chatsById = getGlobal().chats.byId;
    const newlyAddedIds = newSelectedIds.filter((id) => !selectedIds.includes(id));
    const privateLinkChannelId = newlyAddedIds.find((id) => {
      const chat = chatsById[id];
      return chat && !isChatPublic(chat);
    });

    if (selectedIds?.length >= selectionLimit) {
      showNotification({
        message: lang('BoostingSelectUpToWarningChannelsPlural', selectionLimit),
      });
      return;
    }

    if (privateLinkChannelId) {
      setPendingChannelId(privateLinkChannelId);
      openConfirmModal();
    } else {
      setSelectedIds(newSelectedIds);
    }
  });

  const handleClose = useLastCallback(() => {
    onSubmit([]);
    onClose();
  });

  function renderSearchField() {
    return (
      <div className={styles.filter} dir={lang.isRtl ? 'rtl' : undefined}>
        <Button
          round
          size="smaller"
          color="translucent"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={handleCloseButtonClick}
          ariaLabel={lang('Close')}
        >
          <Icon name="close" />
        </Button>
        <h3 className={styles.title}>{lang(entityType === 'channels'
          ? 'RequestPeer.ChooseChannelTitle' : 'BoostingAwardSpecificUsers')}
        </h3>
      </div>
    );
  }

  return (
    <Modal
      className={styles.root}
      isOpen={isOpen}
      onClose={handleClose}
      onEnter={handleSendIdList}
    >
      <div className={styles.main}>
        {renderSearchField()}
        <div className={buildClassName(styles.main, 'custom-scroll')}>
          <Picker
            className={styles.picker}
            itemIds={entityType === 'members' ? displayedMembersIds : displayedChannelIds}
            selectedIds={selectedIds}
            filterValue={searchQuery}
            filterPlaceholder={lang('Search')}
            searchInputId={`${entityType}-picker-search`}
            onSelectedIdsChange={entityType === 'channels'
              ? handleSelectedChannelIdsChange : handleSelectedMemberIdsChange}
            onFilterChange={setSearchQuery}
            isSearchable
          />
        </div>
        <div className={styles.buttons}>
          <Button size="smaller" onClick={handleSendIdList}>
            {lang('Save')}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        title={lang('BoostingGiveawayPrivateChannel')}
        text={lang('BoostingGiveawayPrivateChannelWarning')}
        confirmLabel={lang('Add')}
        isOpen={isConfirmModalOpen}
        onClose={closeConfirmModal}
        confirmHandler={confirmPrivateLinkChannelSelection}
      />
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>((global, { chatId, entityType }): StateProps => {
  const { statusesById: userStatusesById } = global.users;
  let isChannel;
  let isSuperGroup;
  let members: ApiChatMember[] | undefined;
  let adminMembersById: Record<string, ApiChatMember> | undefined;
  let currentUserId: string | undefined;

  if (entityType === 'members') {
    currentUserId = global.currentUserId;
    const chatFullInfo = chatId ? selectChatFullInfo(global, chatId) : undefined;
    if (chatFullInfo) {
      members = chatFullInfo.members;
      adminMembersById = chatFullInfo.adminMembersById;
    }
  } if (entityType === 'channels') {
    const chat = chatId ? selectChat(global, chatId) : undefined;
    if (chat) {
      isChannel = isChatChannel(chat);
      isSuperGroup = isChatSuperGroup(chat);
    }
  }

  return {
    chatId,
    members,
    adminMembersById,
    userStatusesById,
    isChannel,
    isSuperGroup,
    currentUserId,
  };
})(AppendEntityPickerModal));
