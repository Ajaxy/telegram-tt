import type { FC } from '../../lib/teact/teact';
import React, {
  memo,
  useEffect,
  useMemo,
  useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiChat, ApiChatMember } from '../../api/types';
import type { IRadioOption } from '../ui/CheckboxGroup';

import {
  getHasAdminRight,
  getPrivateChatUserId,
  getUserFirstOrLastName,
  getUserFullName,
  isChatBasicGroup, isChatChannel,
  isChatSuperGroup,
  isUserId,
} from '../../global/helpers';
import {
  selectCanDeleteSelectedMessages,
  selectChatFullInfo,
  selectCurrentChat,
  selectCurrentMessageIds,
  selectCurrentMessageList,
  selectSenderFromMessage,
  selectSendersFromSelectedMessages,
  selectTabState,
  selectUser,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { buildCollectionByCallback } from '../../util/iteratees';
import renderText from '../common/helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import usePrevious from '../../hooks/usePrevious';
import useManagePermissions from '../right/hooks/useManagePermissions';

import Avatar from '../common/Avatar';
import AvatarList from '../common/AvatarList';
import Icon from '../common/icons/Icon';
import PermissionCheckboxList from '../main/PermissionCheckboxList';
import Button from '../ui/Button';
import CheckboxGroup from '../ui/CheckboxGroup';
import ListItem from '../ui/ListItem';
import Modal from '../ui/Modal';

import styles from './DeleteSelectedMessageModal.module.scss';

export type OwnProps = {
  isOpen: boolean;
  isSchedule: boolean;
  onClose: () => void;
};

type StateProps = {
  chat?: ApiChat;
  isGroup?: boolean;
  isChannel?: boolean;
  isSuperGroup?: boolean;
  selectedMessageIds?: number[];
  canDeleteForAll?: boolean;
  contactName?: string;
  currentUserId?: string;
  willDeleteForCurrentUserOnly?: boolean;
  willDeleteForAll?: boolean;
  messageIds: number[] | undefined;
  adminMembersById?: Record<string, ApiChatMember>;
  canBanUsers?: boolean;
};

const DeleteSelectedMessageModal: FC<OwnProps & StateProps> = ({
  chat,
  isChannel,
  isGroup,
  isSuperGroup,
  isOpen,
  isSchedule,
  currentUserId,
  selectedMessageIds,
  canDeleteForAll,
  contactName,
  willDeleteForCurrentUserOnly,
  willDeleteForAll,
  messageIds,
  onClose,
  adminMembersById,
  canBanUsers,
}) => {
  const {
    deleteMessages,
    reportMessages,
    deleteChatMember,
    deleteScheduledMessages,
    exitMessageSelectMode,
    updateChatMemberBannedRights,
  } = getActions();

  const prevIsOpen = usePrevious(isOpen);

  const oldLang = useOldLang();
  const lang = useLang();

  const {
    permissions, havePermissionChanged, handlePermissionChange, resetPermissions,
  } = useManagePermissions(chat?.defaultBannedRights);

  const [chosenDeleteOption, setChosenDeleteOption] = useState<string[] | undefined>(undefined);
  const [chosenBanOption, setChosenBanOptions] = useState<string[] | undefined>(undefined);
  const [chosenSpanOption, setChosenSpanOptions] = useState<string[] | undefined>(undefined);
  const [isMediaDropdownOpen, setIsMediaDropdownOpen] = useState(false);
  const [isAdditionalOptionsVisible, setIsAdditionalOptionsVisible] = useState(false);

  const senderList = useMemo(() => {
    if (isChannel) {
      return undefined;
    }
    return selectSendersFromSelectedMessages(getGlobal(), chat);
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [chat, isChannel, isOpen]);

  const isSenderOwner = useMemo(() => {
    if (!senderList) {
      return undefined;
    }

    return senderList.some((sender) => sender
      && adminMembersById
      && adminMembersById[sender.id] && adminMembersById[sender.id].isOwner);
  }, [senderList, adminMembersById]);

  const userList = useMemo(() => {
    const usersById = getGlobal().users.byId;
    if (!senderList || isSchedule) return [];
    const uniqueUserIds = new Set(senderList.map((user) => user!.id));

    return Array.from(uniqueUserIds)
      .map((id) => usersById[id])
      .filter(Boolean);
  }, [isSchedule, senderList]);

  const nestedOptionsWithAvatarList = useLastCallback(() => {
    return userList.map((user) => ({
      value: `${user.id}`,
      label: getUserFullName(user) || '',
      leftElement: <Avatar size="small" peer={user} />,
    }));
  });

  const showAdditionalOptions = useMemo(() => {
    return !userList.some((user) => user.id === currentUserId);
  }, [userList, currentUserId]);

  const userNames = useMemo(() => {
    const usersById = getGlobal().users.byId;
    if (!senderList || isSchedule) return {};

    const uniqueUserIds = new Set(senderList.map((user) => user!.id));
    const userIds = Array.from(uniqueUserIds).map((userId) => usersById[userId]);

    return buildCollectionByCallback(userIds, (user) => [user.id, getUserFullName(user)]);
  }, [isSchedule, senderList]);

  const ACTION_SPAM_OPTION: IRadioOption[] = useMemo(() => {
    return [
      {
        value: selectedMessageIds && userList.length >= 2 ? 'spam' : userList?.[0]?.id,
        label: oldLang('ReportSpamTitle'),
        nestedOptions: selectedMessageIds && userList.length >= 2 ? [
          ...nestedOptionsWithAvatarList(),
        ] : undefined,
      },
    ];
  }, [oldLang, selectedMessageIds, userList]);

  const ACTION_DELETE_OPTION: IRadioOption[] = useMemo(() => {
    return [
      {
        value: selectedMessageIds && userList.length >= 2 ? 'delete_all' : userList?.[0]?.id,
        label: selectedMessageIds && userList.length >= 2
          ? oldLang('DeleteAllFromUsers')
          : oldLang('DeleteAllFrom', Object.values(userNames)[0]),
        nestedOptions: selectedMessageIds && userList.length >= 2 ? [
          ...nestedOptionsWithAvatarList(),
        ] : undefined,
      },
    ];
  }, [oldLang, selectedMessageIds, userList, userNames]);

  const ACTION_BAN_OPTION: IRadioOption[] = useMemo(() => {
    return [
      {
        value: selectedMessageIds && userList.length >= 2 ? 'ban' : userList?.[0]?.id,
        label: selectedMessageIds && userList.length >= 2
          ? (isAdditionalOptionsVisible ? oldLang('DeleteRestrictUsers') : oldLang('DeleteBanUsers'))
          : (isAdditionalOptionsVisible ? oldLang('KickFromSupergroup')
            : oldLang('DeleteBan', Object.values(userNames)[0])),
        nestedOptions: selectedMessageIds && userList.length >= 2 ? [
          ...nestedOptionsWithAvatarList(),
        ] : undefined,
      },
    ];
  }, [isAdditionalOptionsVisible, oldLang, selectedMessageIds, userList, userNames]);

  const toggleAdditionalOptions = useLastCallback(() => {
    setIsAdditionalOptionsVisible((prev) => !prev);
  });

  const handleDeleteMessageForAll = useLastCallback(() => {
    onClose();
    deleteMessages({ messageIds: selectedMessageIds!, shouldDeleteForAll: true });
  });

  const filterMessageIdByUserId = useLastCallback((userIds: string[], selectedMessageIdList: number[]) => {
    return selectedMessageIdList.filter((msgId) => {
      const sender = selectSenderFromMessage(getGlobal(), chat, msgId);
      return sender && userIds.includes(sender.id);
    });
  });

  const handleDeleteMessages = useLastCallback((filteredMessageIdList: number[]) => {
    if (filteredMessageIdList && filteredMessageIdList.length) {
      deleteMessages({ messageIds: filteredMessageIdList, shouldDeleteForAll: true });
    }
  });

  const handleDeleteMember = useLastCallback((filteredUserIdList: string[]) => {
    filteredUserIdList.forEach((userId) => {
      deleteChatMember({ chatId: chat!.id, userId });
    });
  });

  const handleUpdateChatMemberBannedRights = useLastCallback((filteredUserIdList: string[]) => {
    filteredUserIdList.forEach((userId) => {
      updateChatMemberBannedRights({
        chatId: chat!.id,
        userId,
        bannedRights: permissions,
      });
    });
  });

  const handleDeleteMessageForSelf = useLastCallback(() => {
    if (isSchedule) {
      deleteScheduledMessages({ messageIds: selectedMessageIds! });
    } else if (!isSenderOwner
      && (chosenSpanOption || chosenDeleteOption || chosenBanOption) && (isGroup || isSuperGroup)) {
      if (chosenSpanOption) {
        const userIdList = chosenSpanOption.filter((option) => !Number.isNaN(Number(option)));
        const filteredMessageIdList = filterMessageIdByUserId(userIdList, selectedMessageIds!);
        if (filteredMessageIdList && filteredMessageIdList.length) {
          reportMessages({ messageIds: filteredMessageIdList, reason: 'spam', description: '' });
        }
      }

      if (chosenDeleteOption) {
        const userIdList = chosenDeleteOption.filter((option) => !Number.isNaN(Number(option)));
        const filteredMessageIdList = filterMessageIdByUserId(userIdList, messageIds!);
        handleDeleteMessages(filteredMessageIdList);
      }

      if (chosenBanOption && !havePermissionChanged) {
        const userIdList = chosenBanOption.filter((option) => !Number.isNaN(Number(option)));
        const filteredUserIdList = userIdList.filter((userId) => selectedMessageIds?.some((msgId) => {
          const sender = selectSenderFromMessage(getGlobal(), chat, msgId);
          return sender && sender.id === userId;
        }));
        handleDeleteMember(filteredUserIdList);
        const filteredMessageIdList = filterMessageIdByUserId(userIdList, selectedMessageIds!);
        handleDeleteMessages(filteredMessageIdList);
      }

      if (chosenBanOption && havePermissionChanged) {
        const userIdList = chosenBanOption.filter((option) => !Number.isNaN(Number(option)));
        const filteredUserIdList = userIdList.filter((userId) => selectedMessageIds?.some((msgId) => {
          const sender = selectSenderFromMessage(getGlobal(), chat, msgId);
          return sender && sender.id === userId;
        }));
        handleUpdateChatMemberBannedRights(filteredUserIdList);
      }
    } else {
      deleteMessages({ messageIds: selectedMessageIds!, shouldDeleteForAll: false });
    }

    onClose();
  });

  const onCloseHandler = useLastCallback(() => {
    onClose();
  });

  const handleDeleteOptionChange = useLastCallback((options: string[]) => {
    setChosenDeleteOption(options);
  });

  const handleBanOptionChange = useLastCallback((options: string[]) => {
    setChosenBanOptions(options);
  });

  const handleSpanOptionChange = useLastCallback((options: string[]) => {
    setChosenSpanOptions(options);
  });

  useEffect(() => {
    if (!isOpen && prevIsOpen) {
      exitMessageSelectMode();
      setChosenSpanOptions(undefined);
      setChosenDeleteOption(undefined);
      setChosenBanOptions(undefined);
      setIsMediaDropdownOpen(false);
      setIsAdditionalOptionsVisible(false);
      resetPermissions();
    }
  }, [exitMessageSelectMode, isOpen, prevIsOpen, resetPermissions]);

  function renderHeader() {
    return (
      <div className={styles.container} dir={oldLang.isRtl ? 'rtl' : undefined}>
        {(showAdditionalOptions && !canDeleteForAll && !isSchedule) && (
          <AvatarList
            size="small"
            peers={userList}
          />
        )}
        <h3 className={styles.title}>{oldLang('Chat.DeleteMessagesConfirmation', selectedMessageIds?.length)}
        </h3>
      </div>
    );
  }

  function renderAdditionalActionOptions() {
    return (
      <div className={styles.options}>
        <CheckboxGroup
          options={ACTION_SPAM_OPTION}
          onChange={handleSpanOptionChange}
          selected={chosenSpanOption}
          nestedCheckbox={selectedMessageIds && userList.length >= 2}
        />
        <CheckboxGroup
          options={ACTION_DELETE_OPTION}
          onChange={handleDeleteOptionChange}
          selected={chosenDeleteOption}
          nestedCheckbox={selectedMessageIds && userList.length >= 2}
        />
        {!isSenderOwner && canBanUsers && (
          <CheckboxGroup
            options={ACTION_BAN_OPTION}
            onChange={handleBanOptionChange}
            selected={chosenBanOption}
            nestedCheckbox={selectedMessageIds && userList.length >= 2}
          />
        )}
      </div>
    );
  }

  function renderPartiallyRestrictedUser() {
    return (
      <div className={buildClassName(styles.restrictionContainer,
        isAdditionalOptionsVisible && styles.restrictionContainerOpen)}
      >
        <h3 className={buildClassName(styles.actionTitle, styles.restrictionTitle)}>
          {oldLang('UserRestrictionsCanDoUsers', userList.length)}
        </h3>
        <PermissionCheckboxList
          withCheckbox
          permissionGroup
          chatId={chat?.id}
          isMediaDropdownOpen={isMediaDropdownOpen}
          setIsMediaDropdownOpen={setIsMediaDropdownOpen}
          handlePermissionChange={handlePermissionChange}
          permissions={permissions}
          className={buildClassName(styles.dropdownList, isMediaDropdownOpen && styles.dropdownListOpen)}
        />
      </div>
    );
  }

  if (!selectedMessageIds) {
    return undefined;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onEnter={canDeleteForAll ? undefined : handleDeleteMessageForSelf}
      className="delete"
    >
      <div className={styles.main}>
        {renderHeader()}
        {!showAdditionalOptions && <p>{lang('AreYouSureDeleteFewMessages')}</p>}
        {(showAdditionalOptions && !canDeleteForAll && !isSchedule && (isGroup || isSuperGroup)) && (
          <>
            <p className={styles.actionTitle}>{oldLang('DeleteAdditionalActions')}</p>
            {renderAdditionalActionOptions()}
            {renderPartiallyRestrictedUser()}
            {
              chosenBanOption && canBanUsers && chosenBanOption?.length ? (
                <ListItem
                  narrow
                  className={styles.listItemButton}
                  buttonClassName={styles.button}
                  onClick={toggleAdditionalOptions}
                >
                  {oldLang(isAdditionalOptionsVisible ? 'DeleteToggleBanUsers' : 'DeleteToggleRestrictUsers')}
                  <Icon
                    name={isAdditionalOptionsVisible ? 'up' : 'down'}
                    className={buildClassName(styles.button, 'ml-2')}
                  />
                </ListItem>
              ) : setIsAdditionalOptionsVisible(false)
            }
          </>
        )}
        {willDeleteForCurrentUserOnly && lang('DeleteForMeDescription')}
        {(willDeleteForAll && !showAdditionalOptions) && lang('DeleteForEveryoneDescription')}
        <div className={canDeleteForAll ? 'dialog-buttons-column'
          : buildClassName('dialog-buttons', isAdditionalOptionsVisible && styles.dialogButtons)}
        >
          {canDeleteForAll && (
            <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteMessageForAll}>
              {contactName
                ? renderText(oldLang('ChatList.DeleteForEveryone', contactName))
                : oldLang('Conversation.DeleteMessagesForEveryone')}
            </Button>
          )}
          <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteMessageForSelf}>
            {oldLang(canDeleteForAll ? 'ChatList.DeleteForCurrentUser' : 'Delete')}
          </Button>
          <Button className="confirm-dialog-button" isText onClick={onCloseHandler}>{oldLang('Cancel')}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { isSchedule }): StateProps => {
    const { messageIds: selectedMessageIds } = selectTabState(global).selectedMessages || {};
    const { canDeleteForAll } = selectCanDeleteSelectedMessages(global);
    const chat = selectCurrentChat(global);
    const chatFullInfo = chat && selectChatFullInfo(global, chat.id);
    const { threadId, type } = selectCurrentMessageList(global) || {};
    const messageIds = chat && selectCurrentMessageIds(global, chat.id, threadId!, type!);
    const isChannel = Boolean(chat) && isChatChannel(chat);
    const isGroup = Boolean(chat) && isChatBasicGroup(chat);
    const isSuperGroup = Boolean(chat) && isChatSuperGroup(chat);
    const contactName = chat && isUserId(chat.id)
      ? getUserFirstOrLastName(selectUser(global, getPrivateChatUserId(chat)!))
      : undefined;
    const adminMembersById = chatFullInfo?.adminMembersById;
    const canBanUsers = chat && (chat.isCreator || getHasAdminRight(chat, 'banUsers'));
    const willDeleteForCurrentUserOnly = chat && isChatBasicGroup(chat) && !canDeleteForAll;
    const willDeleteForAll = chat && isChatSuperGroup(chat);

    return {
      chat,
      isGroup,
      isChannel,
      isSuperGroup,
      selectedMessageIds,
      currentUserId: global.currentUserId,
      canDeleteForAll: !isSchedule && canDeleteForAll,
      contactName,
      willDeleteForCurrentUserOnly,
      willDeleteForAll,
      messageIds,
      adminMembersById,
      canBanUsers,
    };
  },
)(DeleteSelectedMessageModal));
