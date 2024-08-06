import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect,
  useMemo,
  useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type {
  ApiChat, ApiChatMember, ApiMessage, ApiPeer,
} from '../../api/types';
import type { IAlbum } from '../../types';
import type { IRadioOption } from '../ui/CheckboxGroup';

import { REPLIES_USER_ID } from '../../config';
import {
  getHasAdminRight,
  getPrivateChatUserId,
  getUserFirstOrLastName, getUserFullName,
  isChatBasicGroup,
  isChatSuperGroup, isOwnMessage,
  isUserId,
} from '../../global/helpers';
import {
  selectAllowedMessageActions,
  selectBot,
  selectChat, selectChatFullInfo, selectCurrentMessageIds,
  selectCurrentMessageList, selectSenderFromMessage, selectTabState,
  selectUser,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import renderText from './helpers/renderText';

import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import usePrevious from '../../hooks/usePrevious';
import useManagePermissions from '../right/hooks/useManagePermissions';

import PermissionCheckboxList from '../main/PermissionCheckboxList';
import Button from '../ui/Button';
import CheckboxGroup from '../ui/CheckboxGroup';
import ListItem from '../ui/ListItem';
import Modal from '../ui/Modal';
import Avatar from './Avatar';
import Icon from './icons/Icon';

import styles from './DeleteMessageModal.module.scss';

export type OwnProps = {
  isOpen?: boolean;
};

type StateProps = {
  chat?: ApiChat;
  isGroup?: boolean;
  isSuperGroup?: boolean;
  sender: ApiPeer | undefined;
  currentUserId?: string;
  canDeleteForAll?: boolean;
  contactName?: string;
  willDeleteForCurrentUserOnly?: boolean;
  willDeleteForAll?: boolean;
  messageIdList: number[] | undefined;
  adminMembersById?: Record<string, ApiChatMember>;
  chatBot?: boolean;
  isSchedule?: boolean;
  message?: ApiMessage;
  album?: IAlbum;
  onConfirm?: NoneToVoidFunction;
  isOwn?: boolean;
  canBanUsers?: boolean;
};

const DeleteMessageModal: FC<OwnProps & StateProps> = ({
  isOpen,
  chat,
  isGroup,
  isSuperGroup,
  sender,
  currentUserId,
  messageIdList,
  isSchedule,
  message,
  album,
  canDeleteForAll,
  contactName,
  willDeleteForCurrentUserOnly,
  willDeleteForAll,
  onConfirm,
  adminMembersById,
  chatBot,
  isOwn,
  canBanUsers,
}) => {
  const {
    deleteMessages,
    deleteScheduledMessages,
    reportMessages,
    deleteChatMember,
    updateChatMemberBannedRights,
    closeDeleteMessageModal,
  } = getActions();

  const prevIsOpen = usePrevious(isOpen);

  const lang = useOldLang();

  const {
    permissions, havePermissionChanged, handlePermissionChange, resetPermissions,
  } = useManagePermissions(chat?.defaultBannedRights);

  const [chosenDeleteOption, setChosenDeleteOption] = useState<string[] | undefined>(undefined);
  const [chosenBanOption, setChosenBanOptions] = useState<string[] | undefined>(undefined);
  const [chosenSpanOption, setChosenSpanOptions] = useState<string[] | undefined>(undefined);
  const [isMediaDropdownOpen, setIsMediaDropdownOpen] = useState(false);
  const [isAdditionalOptionsVisible, setIsAdditionalOptionsVisible] = useState(false);
  const isSenderOwner = useMemo(() => {
    return sender && adminMembersById && adminMembersById[sender.id] && adminMembersById[sender.id].isOwner;
  }, [sender, adminMembersById]);

  const user = useMemo(() => {
    const usersById = getGlobal().users.byId;
    if (!sender || isSchedule) return undefined;

    return usersById[sender.id];
  }, [isSchedule, sender]);

  const shouldShowAdditionalOptions = useMemo(() => {
    return user && user.id !== currentUserId;
  }, [user, currentUserId]);

  const userName = useMemo(() => {
    const usersById = getGlobal().users.byId;
    if (!sender || isSchedule) return '';

    return getUserFullName(usersById[sender.id]);
  }, [isSchedule, sender]);

  const ACTION_SPAM_OPTION: IRadioOption[] = useMemo(() => {
    if (!user) {
      return [];
    }

    return [
      {
        value: user.id,
        label: lang('ReportSpamTitle'),
      },
    ];
  }, [lang, user]);

  const ACTION_DELETE_OPTION: IRadioOption[] = useMemo(() => {
    if (!user) {
      return [];
    }

    return [
      {
        value: user.id,
        label: lang('DeleteAllFrom', userName),
      },
    ];
  }, [lang, user, userName]);

  const ACTION_BAN_OPTION: IRadioOption[] = useMemo(() => {
    if (!user) {
      return [];
    }

    return [
      {
        value: user.id,
        label: (message && isAdditionalOptionsVisible ? lang('KickFromSupergroup') : lang('DeleteBan', userName)),
      },
    ];
  }, [isAdditionalOptionsVisible, lang, message, user, userName]);

  const toggleAdditionalOptions = useLastCallback(() => {
    setIsAdditionalOptionsVisible(!isAdditionalOptionsVisible);
  });

  const filterMessageIdByUserId = useLastCallback((userIds: string[], selectedMessageIdList: number[]) => {
    return selectedMessageIdList.filter((msgId) => {
      const senderPeer = selectSenderFromMessage(getGlobal(), chat, msgId);
      return senderPeer && userIds.includes(senderPeer.id);
    });
  });

  const handleDeleteMessages = useLastCallback((filteredMessageIdList: number[]) => {
    if (filteredMessageIdList?.length) {
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

  const handleDeleteMessageForAll = useLastCallback(() => {
    onConfirm?.();
    const messageIds = album?.messages
      ? album.messages.map(({ id }) => id)
      : [message!.id];
    deleteMessages({ messageIds, shouldDeleteForAll: true });
    closeDeleteMessageModal();
  });

  const handleDeleteMessageForSelf = useLastCallback(() => {
    onConfirm?.();
    const messageIds = album?.messages
      ? album.messages.map(({ id }) => id)
      : [message!.id];
    if (isSchedule) {
      deleteScheduledMessages({ messageIds });
    } else if (!isOwn && (chosenSpanOption || chosenDeleteOption || chosenBanOption) && (isGroup || isSuperGroup)) {
      if (chosenSpanOption) {
        const filteredMessageIdList = filterMessageIdByUserId(chosenSpanOption, messageIdList!);
        if (filteredMessageIdList && filteredMessageIdList.length) {
          reportMessages({ messageIds: filteredMessageIdList, reason: 'spam', description: '' });
        }
      }

      if (chosenDeleteOption) {
        const filteredMessageIdList = filterMessageIdByUserId(chosenDeleteOption, messageIdList!);
        handleDeleteMessages(filteredMessageIdList);
      }

      if (chosenBanOption && !havePermissionChanged && message) {
        const filteredUserIdList = chosenBanOption.filter((userId) => messageIds?.some((msgId) => {
          const senderPeer = selectSenderFromMessage(getGlobal(), chat, msgId);
          return senderPeer && senderPeer.id === userId;
        }));
        handleDeleteMember(filteredUserIdList);
        deleteMessages({
          messageIds: [message.id],
          shouldDeleteForAll: false,
        });
      }

      if (chosenBanOption && havePermissionChanged) {
        const filteredUserIdList = chosenBanOption.filter((userId) => messageIds?.some((msgId) => {
          const senderPeer = selectSenderFromMessage(getGlobal(), chat, msgId);
          return senderPeer && senderPeer.id === userId;
        }));
        handleUpdateChatMemberBannedRights(filteredUserIdList);
      }
    } else {
      deleteMessages({
        messageIds,
        shouldDeleteForAll: false,
      });
    }
    closeDeleteMessageModal();
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

  const handleClose = useLastCallback(() => {
    closeDeleteMessageModal();
  });

  useEffect(() => {
    if (!isOpen && prevIsOpen) {
      setChosenSpanOptions(undefined);
      setChosenDeleteOption(undefined);
      setChosenBanOptions(undefined);
      setIsMediaDropdownOpen(false);
      setIsAdditionalOptionsVisible(false);
      resetPermissions();
    }
  }, [isOpen, prevIsOpen, resetPermissions]);

  function renderHeader() {
    return (
      <div className={styles.container} dir={lang.isRtl ? 'rtl' : undefined}>
        {(shouldShowAdditionalOptions && !canDeleteForAll && !isSchedule) && (
          <Avatar
            size="small"
            peer={user!}
          />
        )}
        <h3 className={styles.title}>{lang('DeleteSingleMessagesTitle')}
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
        />
        <CheckboxGroup
          options={ACTION_DELETE_OPTION}
          onChange={handleDeleteOptionChange}
          selected={chosenDeleteOption}
        />
        {!isSenderOwner && canBanUsers && (
          <CheckboxGroup
            options={ACTION_BAN_OPTION}
            onChange={handleBanOptionChange}
            selected={chosenBanOption}
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
          {lang('UserRestrictionsCanDoUsers', 1)}
        </h3>
        <PermissionCheckboxList
          withCheckbox
          permissionGroup
          chatId={chat?.id}
          isMediaDropdownOpen={isMediaDropdownOpen}
          setIsMediaDropdownOpen={setIsMediaDropdownOpen}
          handlePermissionChange={handlePermissionChange}
          permissions={permissions}
          className={buildClassName(
            styles.dropdownList,
            isMediaDropdownOpen && styles.dropdownListOpen,
          )}
        />
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      onEnter={canDeleteForAll ? undefined : handleDeleteMessageForSelf}
      className="delete"
    >
      <div className={buildClassName(styles.mainContainer, 'custom-scroll')}>
        {renderHeader()}
        {(shouldShowAdditionalOptions && !canDeleteForAll && !isSchedule && (isGroup || isSuperGroup)) && (
          <>
            <p className={styles.actionTitle}>{lang('DeleteAdditionalActions')}</p>
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
                  {lang(isAdditionalOptionsVisible ? 'DeleteToggleBanUsers' : 'DeleteToggleRestrictUsers')}
                  <Icon
                    name={isAdditionalOptionsVisible ? 'up' : 'down'}
                    className={buildClassName(styles.button, 'ml-2')}
                  />
                </ListItem>
              ) : setIsAdditionalOptionsVisible(false)
            }
          </>
        )}
        {(chatBot || !shouldShowAdditionalOptions) && (
          <>
            <p>{lang('AreYouSureDeleteSingleMessage')}</p>
            {willDeleteForCurrentUserOnly && (
              <p>{lang('lng_delete_for_me_chat_hint', 1, 'i')}</p>
            )}
            {willDeleteForAll && (
              <p>{lang('lng_delete_for_everyone_hint', 1, 'i')}</p>
            )}
          </>
        )}
        <div className={canDeleteForAll ? 'dialog-buttons-column'
          : buildClassName('dialog-buttons', isAdditionalOptionsVisible && styles.dialogButtons)}
        >
          {canDeleteForAll && (
            <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteMessageForAll}>
              {contactName && renderText(lang('Conversation.DeleteMessagesFor', contactName))}
              {!contactName && lang('Conversation.DeleteMessagesForEveryone')}
            </Button>
          )}
          <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteMessageForSelf}>
            {lang(canDeleteForAll ? 'ChatList.DeleteForCurrentUser' : 'Delete')}
          </Button>
          <Button
            className="confirm-dialog-button"
            isText
            onClick={handleClose}
          >{lang('Cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      deleteMessageModal,
    } = selectTabState(global);
    const chatId = deleteMessageModal && deleteMessageModal.message?.chatId;
    const chat = chatId ? selectChat(global, chatId) : undefined;
    const chatFullInfo = chat && selectChatFullInfo(global, chat.id);
    const { threadId, type } = selectCurrentMessageList(global) || {};
    const { canDeleteForAll } = (deleteMessageModal && deleteMessageModal.message && threadId
      && selectAllowedMessageActions(global, deleteMessageModal.message, threadId)) || {};
    const adminMembersById = chatFullInfo && chatFullInfo?.adminMembersById;
    const messageIdList = chat && selectCurrentMessageIds(global, chat.id, threadId!, type!);
    const isGroup = Boolean(chat) && isChatBasicGroup(chat);
    const isSuperGroup = Boolean(chat) && isChatSuperGroup(chat);
    const sender = deleteMessageModal && chat && deleteMessageModal.message
      && selectSenderFromMessage(global, chat, deleteMessageModal.message.id);
    const contactName = chat && isUserId(chat.id)
      ? getUserFirstOrLastName(selectUser(global, getPrivateChatUserId(chat)!))
      : undefined;
    const isChatWithBot = Boolean(deleteMessageModal && deleteMessageModal.message
      && selectBot(global, deleteMessageModal.message.chatId));
    const chatBot = Boolean(chat && chat.id !== REPLIES_USER_ID && selectBot(global, chat.id));
    const canBanUsers = chat && (chat.isCreator || getHasAdminRight(chat, 'banUsers'));
    const isOwn = deleteMessageModal && deleteMessageModal.message && isOwnMessage(deleteMessageModal.message);

    const willDeleteForCurrentUserOnly = (chat && isChatBasicGroup(chat) && !canDeleteForAll) || isChatWithBot;
    const willDeleteForAll = chat && isChatSuperGroup(chat);

    return {
      chat,
      isGroup,
      isSuperGroup,
      currentUserId: global.currentUserId,
      sender,
      messageIdList,
      canDeleteForAll: deleteMessageModal && !deleteMessageModal.isSchedule && canDeleteForAll,
      contactName,
      willDeleteForCurrentUserOnly,
      willDeleteForAll,
      adminMembersById,
      chatBot,
      isSchedule: deleteMessageModal && deleteMessageModal.isSchedule,
      message: deleteMessageModal && deleteMessageModal.message,
      album: deleteMessageModal && deleteMessageModal.album,
      onConfirm: deleteMessageModal && deleteMessageModal.onConfirm,
      isOwn,
      canBanUsers,
    };
  },
)(DeleteMessageModal));
