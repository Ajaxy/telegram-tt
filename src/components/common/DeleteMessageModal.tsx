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
  getPeerTitle,
  getPrivateChatUserId,
  getUserFirstOrLastName, isChatBasicGroup,
  isChatChannel,
  isChatSuperGroup,
  isSystemBot,
  isUserId,
} from '../../global/helpers';
import {
  getSendersFromSelectedMessages,
  selectBot,
  selectCanDeleteSelectedMessages,
  selectChat,
  selectChatFullInfo, selectIsChatWithBot,
  selectSenderFromMessage,
  selectTabState,
  selectUser,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { buildCollectionByCallback, unique } from '../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import renderText from './helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';
import useManagePermissions from '../right/hooks/useManagePermissions';

import PermissionCheckboxList from '../main/PermissionCheckboxList';
import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import CheckboxGroup from '../ui/CheckboxGroup';
import ListItem from '../ui/ListItem';
import Modal from '../ui/Modal';
import Avatar from './Avatar';
import AvatarList from './AvatarList';
import Icon from './icons/Icon';

import styles from './DeleteMessageModal.module.scss';

export type OwnProps = {
  isOpen?: boolean;
};

type StateProps = {
  chat?: ApiChat;
  isGroup?: boolean;
  isChannel?: boolean;
  isSuperGroup?: boolean;
  messageIds?: number[];
  canDeleteForAll?: boolean;
  contactName?: string;
  currentUserId?: string;
  willDeleteForCurrentUserOnly?: boolean;
  willDeleteForAll?: boolean;
  adminMembersById?: Record<string, ApiChatMember>;
  chatBot?: boolean;
  isSchedule?: boolean;
  onConfirm?: NoneToVoidFunction;
  canBanUsers?: boolean;
  isCreator?: boolean;
  linkedChatId?: string;
};

const DeleteMessageModal: FC<OwnProps & StateProps> = ({
  isOpen,
  chat,
  isChannel,
  isSuperGroup,
  isSchedule,
  currentUserId,
  messageIds,
  isCreator,
  canDeleteForAll,
  contactName,
  willDeleteForCurrentUserOnly,
  willDeleteForAll,
  onConfirm,
  chatBot,
  adminMembersById,
  canBanUsers,
  linkedChatId,
}) => {
  const {
    closeDeleteMessageModal,
    deleteMessages,
    reportChannelSpam,
    deleteChatMember,
    deleteScheduledMessages,
    exitMessageSelectMode,
    updateChatMemberBannedRights,
    deleteParticipantHistory,
  } = getActions();

  const prevIsOpen = usePreviousDeprecated(isOpen);

  const oldLang = useOldLang();
  const lang = useLang();

  const {
    permissions, havePermissionChanged, handlePermissionChange, resetPermissions,
  } = useManagePermissions(chat?.defaultBannedRights);

  const [peerIdsToDeleteAll, setPeerIdsToDeleteAll] = useState<string[] | undefined>(undefined);
  const [peerIdsToBan, setPeerIdsToBan] = useState<string[] | undefined>(undefined);
  const [peerIdsToReportSpam, setPeerIdsToReportSpam] = useState<string[] | undefined>(undefined);
  const [isMediaDropdownOpen, setIsMediaDropdownOpen] = useState(false);
  const [isAdditionalOptionsVisible, setIsAdditionalOptionsVisible] = useState(false);
  const [shouldDeleteForAll, setShouldDeleteForAll] = useState(true);

  const peerList = useMemo(() => {
    if (isChannel || !messageIds || !chat) {
      return MEMO_EMPTY_ARRAY;
    }
    const global = getGlobal();
    const senderArray = getSendersFromSelectedMessages(global, chat.id, messageIds);
    return senderArray ? unique(senderArray)
      .filter((peer) => peer?.id !== chat?.id && peer?.id !== linkedChatId) : MEMO_EMPTY_ARRAY;
  }, [chat, isChannel, linkedChatId, messageIds]);

  const buildNestedOptionListWithAvatars = useLastCallback(() => {
    return peerList.map((member) => {
      return {
        value: `${member.id}`,
        label: getPeerTitle(lang, member) || '',
        leftElement: <Avatar size="small" peer={member} />,
      };
    });
  });

  const peerListToDeleteAll = useMemo(() => {
    return peerList.filter((peer) => peer.id !== linkedChatId && peer.id !== currentUserId);
  }, [peerList, currentUserId, linkedChatId]);

  const peerListToReportSpam = useMemo(() => {
    return peerList.filter((peer) => peer.id !== currentUserId && peer.id !== linkedChatId);
  }, [peerList, currentUserId, linkedChatId]);

  const peerListToBan = useMemo(() => {
    const isCurrentUserInList = peerList.some((peer) => peer.id === currentUserId);
    const shouldReturnEmpty = !canBanUsers || isCurrentUserInList;

    if (shouldReturnEmpty) {
      return MEMO_EMPTY_ARRAY;
    }

    return peerList.filter((peer) => {
      const isAdmin = adminMembersById?.[peer.id];
      return isCreator || !isAdmin;
    });
  }, [peerList, isCreator, currentUserId, canBanUsers, adminMembersById]);

  const shouldShowAdditionalOptions = useMemo(() => {
    return Boolean(peerListToDeleteAll.length || peerListToReportSpam.length || peerListToBan.length);
  }, [peerListToDeleteAll, peerListToReportSpam, peerListToBan]);

  const shouldShowOption = shouldShowAdditionalOptions
    && !canDeleteForAll && !isSchedule && isSuperGroup;

  const peerNames = useMemo(() => {
    if (!peerList || isSchedule) return {};
    return buildCollectionByCallback(peerList, (peer) => [peer.id, getPeerTitle(lang, peer)]);
  }, [isSchedule, lang, peerList]);

  const ACTION_SPAM_OPTION: IRadioOption[] = useMemo(() => {
    return [
      {
        value: messageIds && peerList.length >= 2 ? 'spam' : peerList?.[0]?.id,
        label: oldLang('ReportSpamTitle'),
        nestedOptions: messageIds && peerList.length >= 2 ? [
          ...buildNestedOptionListWithAvatars().filter((opt) => opt.value !== linkedChatId
            && opt.value !== currentUserId),
        ] : undefined,
      },
    ];
  }, [messageIds, peerList, oldLang, linkedChatId, currentUserId]);

  const ACTION_DELETE_OPTION: IRadioOption[] = useMemo(() => {
    return [
      {
        value: messageIds && peerList.length >= 2 ? 'delete_all' : peerList?.[0]?.id,
        label: messageIds && peerList.length >= 2
          ? oldLang('DeleteAllFromUsers')
          : oldLang('DeleteAllFrom', Object.values(peerNames)[0]),
        nestedOptions: messageIds && peerList.length >= 2 ? [
          ...buildNestedOptionListWithAvatars().filter((opt) => opt.value !== linkedChatId
            && opt.value !== currentUserId),
        ] : undefined,
      },
    ];
  }, [messageIds, peerList, oldLang, peerNames, linkedChatId, currentUserId]);

  const ACTION_BAN_OPTION: IRadioOption[] = useMemo(() => {
    return [
      {
        value: messageIds && peerList.length >= 2 ? 'ban' : peerList?.[0]?.id,
        label: messageIds && peerList.length >= 2
          ? (isAdditionalOptionsVisible ? oldLang('DeleteRestrictUsers') : oldLang('DeleteBanUsers'))
          : (isAdditionalOptionsVisible ? oldLang('KickFromSupergroup')
            : oldLang('DeleteBan', Object.values(peerNames)[0])),
        nestedOptions: messageIds && peerList.length >= 2 ? [
          ...buildNestedOptionListWithAvatars(),
        ] : undefined,
      },
    ];
  }, [isAdditionalOptionsVisible, oldLang, messageIds, peerList, peerNames]);

  const toggleAdditionalOptions = useLastCallback(() => {
    setIsAdditionalOptionsVisible((prev) => !prev);
  });

  const filterMessageIdByPeerId = useLastCallback((peerIds: string[], selectedMessageIdList: number[]) => {
    if (!chat) return MEMO_EMPTY_ARRAY;
    const global = getGlobal();
    return selectedMessageIdList.filter((msgId) => {
      const sender = selectSenderFromMessage(global, chat.id, msgId);
      return sender && peerIds.includes(sender.id);
    });
  });

  const handleReportSpam = useLastCallback((userMessagesMap: Record<string, number[]>) => {
    Object.entries(userMessagesMap).forEach(([userId, messageIdList]) => {
      if (messageIdList.length) {
        reportChannelSpam({
          participantId: userId,
          chatId: chat!.id,
          messageIds: messageIdList,
        });
      }
    });
  });

  const handleDeleteMessages = useLastCallback((filteredMessageIdList: number[]) => {
    deleteMessages({ messageIds: filteredMessageIdList, shouldDeleteForAll: true });
  });

  const handleDeleteAllPeerMessages = useLastCallback((peerIdList: string[]) => {
    if (!chat) return;
    peerIdList.forEach((peerId) => {
      deleteParticipantHistory({ peerId, chatId: chat.id });
    });
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

  const handleDeleteMessageList = useLastCallback(() => {
    if (!chat || !messageIds) return;

    onConfirm?.();
    if (isSchedule) {
      deleteScheduledMessages({ messageIds });
    } else if (shouldShowOption) {
      if (peerIdsToReportSpam) {
        const global = getGlobal();
        const peerIdList = peerIdsToReportSpam.filter((option) => !Number.isNaN(Number(option)));
        const messageList = messageIds!.reduce<Record<string, number[]>>((acc, msgId) => {
          const peer = selectSenderFromMessage(global, chat.id, msgId);
          if (peer && peerIdList.includes(peer.id)) {
            if (!acc[peer.id]) {
              acc[peer.id] = [];
            }
            acc[peer.id].push(Number(msgId));
          }
          return acc;
        }, {});

        handleReportSpam(messageList);
      }

      if (peerIdsToDeleteAll) {
        const peerIdList = peerIdsToDeleteAll.filter((option) => !Number.isNaN(Number(option)));
        handleDeleteAllPeerMessages(peerIdList);
      }

      if (peerIdsToBan && !havePermissionChanged) {
        const peerIdList = peerIdsToBan.filter((option) => !Number.isNaN(Number(option)));
        handleDeleteMember(peerIdList);
        const filteredMessageIdList = filterMessageIdByPeerId(peerIdList, messageIds!);
        handleDeleteMessages(filteredMessageIdList);
      }

      if (peerIdsToBan && havePermissionChanged) {
        const peerIdList = peerIdsToBan.filter((option) => !Number.isNaN(Number(option)));
        handleUpdateChatMemberBannedRights(peerIdList);
      }

      if (!peerIdsToReportSpam || !peerIdsToDeleteAll || !peerIdsToBan) {
        deleteMessages({ messageIds, shouldDeleteForAll });
      }
    } else {
      deleteMessages({ messageIds, shouldDeleteForAll });
    }

    closeDeleteMessageModal();
    exitMessageSelectMode();
  });

  const onCloseHandler = useLastCallback(() => {
    closeDeleteMessageModal();
  });

  useEffect(() => {
    if (!isOpen && prevIsOpen) {
      setPeerIdsToReportSpam(undefined);
      setPeerIdsToDeleteAll(undefined);
      setPeerIdsToBan(undefined);
      setShouldDeleteForAll(true);
      setIsMediaDropdownOpen(false);
      setIsAdditionalOptionsVisible(false);
      resetPermissions();
    }
  }, [isOpen, prevIsOpen, resetPermissions]);

  function renderHeader() {
    return (
      <div
        className={shouldShowOption && styles.container}
        dir={oldLang.isRtl ? 'rtl' : undefined}
      >
        {shouldShowOption && (
          <AvatarList
            size="small"
            peers={peerList}
          />
        )}
        <h3 className={buildClassName(shouldShowOption ? styles.title : styles.singleTitle)}>
          {oldLang('Chat.DeleteMessagesConfirmation', messageIds?.length)}
        </h3>
      </div>
    );
  }

  function renderAdditionalActionOptions() {
    return (
      <div className={styles.options}>
        <CheckboxGroup
          options={ACTION_SPAM_OPTION}
          onChange={setPeerIdsToReportSpam}
          selected={peerIdsToReportSpam}
          nestedCheckbox={messageIds && peerList.length >= 2}
        />
        {peerListToDeleteAll?.length > 0 && (
          <CheckboxGroup
            options={ACTION_DELETE_OPTION}
            onChange={setPeerIdsToDeleteAll}
            selected={peerIdsToDeleteAll}
            nestedCheckbox={messageIds && peerList.length >= 2}
          />
        )}
        {peerListToBan?.length > 0 && (
          <CheckboxGroup
            options={ACTION_BAN_OPTION}
            onChange={setPeerIdsToBan}
            selected={peerIdsToBan}
            nestedCheckbox={messageIds && peerList.length >= 2}
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
          {oldLang('UserRestrictionsCanDoUsers', peerList.length)}
        </h3>
        <PermissionCheckboxList
          withCheckbox
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
      onClose={onCloseHandler}
      onEnter={canDeleteForAll ? undefined : handleDeleteMessageList}
      className={styles.root}
    >
      <div className={styles.main}>
        {renderHeader()}
        {shouldShowOption && (
          <>
            <p className={styles.actionTitle}>{oldLang('DeleteAdditionalActions')}</p>
            {renderAdditionalActionOptions()}
            {renderPartiallyRestrictedUser()}
            {
              peerIdsToBan && canBanUsers ? (
                <ListItem
                  narrow
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
        {(canDeleteForAll || chatBot || !shouldShowOption) && (
          <>
            <p>{messageIds && messageIds.length > 1
              ? lang('AreYouSureDeleteFewMessages') : lang('AreYouSureDeleteSingleMessage')}
            </p>
            {willDeleteForCurrentUserOnly && (
              <p>{oldLang('lng_delete_for_me_chat_hint', 1, 'i')}</p>
            )}
            {willDeleteForAll && (
              <p>{oldLang('lng_delete_for_everyone_hint', 1, 'i')}</p>
            )}
          </>
        )}
        {canDeleteForAll && (
          <Checkbox
            className="dialog-checkbox"
            label={contactName ? renderText(oldLang('DeleteMessagesOptionAlso', contactName))
              : oldLang('Conversation.DeleteMessagesForEveryone')}
            checked={shouldDeleteForAll}
            onCheck={setShouldDeleteForAll}
          />
        )}
        <div className={buildClassName('dialog-buttons',
          isMediaDropdownOpen ? styles.dialogButtons : styles.proceedButtons)}
        >
          <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteMessageList}>
            {shouldShowOption ? oldLang('DeleteProceedBtn') : lang('Delete')}
          </Button>
          <Button className="confirm-dialog-button" isText onClick={onCloseHandler}>{oldLang('Cancel')}</Button>
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
    const messageIds = deleteMessageModal?.messageIds;
    const chatId = deleteMessageModal?.chatId;
    const { canDeleteForAll } = selectCanDeleteSelectedMessages(global, messageIds);
    const chat = chatId ? selectChat(global, chatId) : undefined;
    const chatFullInfo = chat && selectChatFullInfo(global, chat.id);
    const linkedChatId = chatFullInfo?.linkedChatId;
    const isChannel = Boolean(chat) && isChatChannel(chat);
    const isSuperGroup = Boolean(chat) && isChatSuperGroup(chat);
    const isSchedule = deleteMessageModal?.isSchedule;
    const onConfirm = deleteMessageModal?.onConfirm;
    const contactName = chat && isUserId(chat.id)
      ? getUserFirstOrLastName(selectUser(global, getPrivateChatUserId(chat)!))
      : undefined;
    const chatBot = Boolean(chat && !isSystemBot(chat.id) && selectBot(global, chat.id));
    const adminMembersById = chatFullInfo?.adminMembersById;
    const canBanUsers = chat && getHasAdminRight(chat, 'banUsers');
    const isCreator = chat?.isCreator;
    const isChatWithBot = chat ? selectIsChatWithBot(global, chat) : undefined;
    const willDeleteForCurrentUserOnly = (chat && isChatBasicGroup(chat) && !canDeleteForAll) || isChatWithBot;
    const willDeleteForAll = chat && (isChatSuperGroup(chat) || isChannel);

    return {
      chat,
      isChannel,
      isSuperGroup,
      messageIds,
      currentUserId: global.currentUserId,
      canDeleteForAll: !isSchedule && canDeleteForAll,
      contactName,
      willDeleteForCurrentUserOnly,
      willDeleteForAll,
      adminMembersById,
      chatBot,
      canBanUsers,
      linkedChatId,
      isSchedule,
      isCreator,
      onConfirm,
    };
  },
)(DeleteMessageModal));
