import { memo, useEffect, useMemo, useState } from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiChat, ApiChatAdminRights, ApiChatFullInfo, ApiChatMember, ApiRequestPeerType, ApiUser,
} from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { RegularLangKey } from '../../../types/language';
import type { LangFn } from '../../../util/localization';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../../../config';
import {
  getHasAdminRight,
  isChatChannel,
  isChatGroup,
  isChatPublic,
  isDeletedUser,
  isSystemBot,
  isUserBot,
  isUserRightBanned,
} from '../../../global/helpers';
import { filterPeersByQuery, getPeerTitle } from '../../../global/helpers/peers';
import { selectPeer, selectUserCommonChats } from '../../../global/selectors';
import { isUserId } from '../../../util/entities/ids';
import { unique } from '../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import sortChatIds from '../../common/helpers/sortChatIds';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import PeerPicker from '../../common/pickers/PeerPicker';
import PickerModal from '../../common/pickers/PickerModal';
import ConfirmDialog from '../../ui/ConfirmDialog';

import styles from './RequestPeerModal.module.scss';

export type OwnProps = {
  modal: TabState['requestPeerModal'];
};

type StateProps = {
  activeListIds?: string[];
  archivedListIds?: string[];
  contactUserIds?: string[];
  usersById: Record<string, ApiUser>;
  chatsById: Record<string, ApiChat>;
  chatFullInfosById: Record<string, ApiChatFullInfo>;
  botCommonChatIds?: string[];
  areBotCommonChatsFullyLoaded?: boolean;
};

const ADMIN_RIGHT_LANG_KEYS: Record<Exclude<keyof ApiChatAdminRights, 'other'>, RegularLangKey> = {
  changeInfo: 'EditAdminChangeGroupInfo',
  postMessages: 'EditAdminPostMessages',
  editMessages: 'EditAdminEditMessages',
  deleteMessages: 'EditAdminGroupDeleteMessages',
  banUsers: 'EditAdminBanUsers',
  inviteUsers: 'EditAdminAddUsers',
  pinMessages: 'EditAdminPinMessages',
  addAdmins: 'EditAdminAddAdmins',
  anonymous: 'EditAdminSendAnonymously',
  manageCall: 'StartVoipChatPermission',
  manageTopics: 'EditAdminManageTopics',
  postStories: 'EditAdminPostStories',
  editStories: 'EditAdminEditStories',
  deleteStories: 'EditAdminDeleteStories',
  manageDirectMessages: 'EditAdminManageDirect',
  manageRanks: 'EditAdminEditRank',
  manageLinkedPeers: 'EditAdminManageLinkedChannels',
  manageWelcomeMessages: 'EditAdminManageWelcomeMessages',
};

const CHANNEL_ADMIN_RIGHT_LANG_KEYS: Partial<Record<keyof ApiChatAdminRights, RegularLangKey>> = {
  changeInfo: 'EditAdminChangeChannelInfo',
  deleteMessages: 'EditAdminDeleteMessages',
};

const RequestPeerModal = ({
  modal,
  activeListIds,
  archivedListIds,
  contactUserIds,
  usersById,
  chatsById,
  chatFullInfosById,
  botCommonChatIds,
  areBotCommonChatsFullyLoaded,
}: OwnProps & StateProps) => {
  const {
    sendBotRequestedPeer, closeRequestPeerModal, showNotification, loadCommonChats,
  } = getActions();

  const lang = useLang();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal, true);
  const { maxQuantity = 1, peerType } = renderingModal || {};
  const isMultiple = maxQuantity > 1;

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isConfirmOpen, openConfirm, closeConfirm] = useFlag();

  useEffect(() => {
    if (isOpen && modal && modal.peerType.type === 'group' && modal.peerType.isBotParticipant
      && !areBotCommonChatsFullyLoaded) {
      loadCommonChats({ userId: modal.botId });
    }
  }, [isOpen, modal, botCommonChatIds?.length, areBotCommonChatsFullyLoaded]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedIds([]);
      closeConfirm();
    }
  }, [isOpen]);

  const displayedIds = useMemo(() => {
    if (!peerType) {
      return MEMO_EMPTY_ARRAY;
    }

    const listIds = (activeListIds || []).concat(archivedListIds || []);

    let ids: string[];
    if (peerType.type === 'user') {
      ids = unique(listIds.filter(isUserId).concat(contactUserIds || [])).filter((id) => {
        const user = usersById[id];
        return user && !isDeletedUser(user) && !isSystemBot(id) && id !== SERVICE_NOTIFICATIONS_USER_ID
          && isUserMatchingType(user, peerType);
      });
    } else {
      const botId = renderingModal!.botId;
      const commonChatIds = new Set(botCommonChatIds);
      const canBotJoinGroups = usersById[botId]?.canBotBeInvitedToGroup !== false;
      ids = unique(listIds).filter((id) => {
        const chat = chatsById[id];
        const botMember = chatFullInfosById[id]?.adminMembersById?.[botId];
        return chat && isChatMatchingType(chat, peerType, commonChatIds, botMember, canBotJoinGroups);
      });
    }

    const foundIds = filterPeersByQuery({
      ids,
      query: searchQuery,
      type: peerType.type === 'user' ? 'user' : 'chat',
    });

    return sortChatIds(foundIds, false, selectedIds);
  }, [
    peerType, searchQuery, selectedIds, activeListIds, archivedListIds, contactUserIds, usersById, chatsById,
    botCommonChatIds, chatFullInfosById, renderingModal,
  ]);

  const confirmText = useMemo(() => {
    if (!renderingModal || !selectedIds.length) {
      return undefined;
    }

    const global = getGlobal();
    const bot = selectPeer(global, renderingModal.botId);
    const peerTitles = selectedIds
      .map((id) => {
        const peer = selectPeer(global, id);
        return peer && getPeerTitle(lang, peer);
      })
      .filter(Boolean);
    if (!bot || !peerTitles.length) {
      return undefined;
    }

    const replacements = {
      peer: lang.conjunction(peerTitles),
      bot: getPeerTitle(lang, bot),
    };
    const options = { withNodes: true, withMarkdown: true } as const;

    const willAddBot = peerType?.type === 'group' && peerType.isBotParticipant
      && selectedIds.some((id) => !botCommonChatIds?.includes(id));
    const botAdminRights = peerType?.type !== 'user' ? peerType?.botAdminRights : undefined;

    const rights = botAdminRights && formatAdminRights(lang, botAdminRights, peerType?.type === 'channel');
    const extraLine = rights ? lang('RequestPeerConfirmBotRights', { ...replacements, rights }, options)
      : (botAdminRights || willAddBot) ? lang('RequestPeerConfirmAddBot', replacements, options) : undefined;

    return (
      <>
        {lang('RequestPeerConfirm', replacements, options)}
        {extraLine ? ' ' : undefined}
        {extraLine}
      </>
    );
  }, [lang, renderingModal, selectedIds, peerType, botCommonChatIds]);

  const requirements = useMemo(() => {
    if (!peerType) return undefined;

    const result: string[] = [];
    if (peerType.type === 'user') {
      if (peerType.isPremium !== undefined) {
        result.push(lang(peerType.isPremium ? 'RequestPeerReqPremium' : 'RequestPeerReqNoPremium'));
      }
    } else {
      const isChannel = peerType.type === 'channel';
      if (peerType.hasUsername !== undefined) {
        result.push(lang(peerType.hasUsername
          ? (isChannel ? 'RequestPeerReqPublicChannel' : 'RequestPeerReqPublicGroup')
          : (isChannel ? 'RequestPeerReqPrivateChannel' : 'RequestPeerReqPrivateGroup')));
      }
      if (peerType.type === 'group' && peerType.isForum !== undefined) {
        result.push(lang(peerType.isForum ? 'RequestPeerReqForum' : 'RequestPeerReqNoForum'));
      }
      if (peerType.isCreator) {
        result.push(lang(isChannel ? 'RequestPeerReqOwnerChannel' : 'RequestPeerReqOwnerGroup'));
      } else if (peerType.userAdminRights) {
        const rights = formatAdminRights(lang, peerType.userAdminRights, isChannel);
        if (rights) {
          result.push(lang('RequestPeerReqAdminRights', { rights }));
        }
      }
      if (peerType.type === 'group' && peerType.isBotParticipant) {
        result.push(lang('RequestPeerReqBotMember'));
      }
    }

    return result.length ? result : undefined;
  }, [lang, peerType]);

  const requirementsSubheader = requirements && (
    <div className={styles.requirements}>
      <p className={styles.requirementsTitle}>{lang('RequestPeerRequirements')}</p>
      <ul className={styles.requirementsList}>
        {requirements.map((requirement) => (
          <li>{requirement}</li>
        ))}
      </ul>
    </div>
  );

  const sendRequestedPeers = useLastCallback((requestedPeerIds: string[]) => {
    if (!renderingModal) return;
    const { chatId, messageId, buttonId } = renderingModal;
    sendBotRequestedPeer({
      chatId,
      messageId,
      buttonId,
      requestedPeerIds,
    });
    closeRequestPeerModal();
  });

  const handleSelectedIdsChange = useLastCallback((newSelectedIds: string[]) => {
    if (newSelectedIds.length > maxQuantity) {
      showNotification({
        message: lang('RequestPeerSelectLimit', { count: maxQuantity }, { pluralValue: maxQuantity }),
      });
      return;
    }
    setSelectedIds(newSelectedIds);
  });

  const handleSelectedIdChange = useLastCallback((id: string) => {
    setSelectedIds([id]);
    if (peerType?.type === 'user') {
      sendRequestedPeers([id]);
    } else {
      openConfirm();
    }
  });

  const handleConfirmClick = useLastCallback(() => {
    if (!selectedIds.length) return;
    if (peerType?.type === 'user') {
      sendRequestedPeers(selectedIds);
    } else {
      openConfirm();
    }
  });

  const handleConfirmSend = useLastCallback(() => {
    closeConfirm();
    sendRequestedPeers(selectedIds);
  });

  const handleConfirmClose = useLastCallback(() => {
    closeConfirm();
    if (!isMultiple) {
      setSelectedIds([]);
    }
  });

  const handleClose = useLastCallback(() => {
    closeRequestPeerModal();
  });

  const titleKey = peerType?.type === 'user'
    ? (peerType.isBot ? 'RequestPeerChooseBot' : 'RequestPeerChooseUser')
    : peerType?.type === 'group' ? 'RequestPeerChooseGroup' : 'RequestPeerChooseChannel';
  const title = lang(titleKey, undefined, { pluralValue: maxQuantity });

  return (
    <PickerModal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      hasCloseButton
      withFixedHeight
      confirmButtonText={isMultiple ? lang('Send') : undefined}
      isConfirmDisabled={!selectedIds.length}
      onConfirm={isMultiple ? handleConfirmClick : undefined}
    >
      {isMultiple ? (
        <PeerPicker
          withIslands
          itemIds={displayedIds}
          selectedIds={selectedIds}
          filterValue={searchQuery}
          filterPlaceholder={lang('Search')}
          onSelectedIdsChange={handleSelectedIdsChange}
          onFilterChange={setSearchQuery}
          isSearchable
          withDefaultPadding
          withStatus
          allowMultiple
          itemInputType="checkbox"
          subheader={requirementsSubheader}
        />
      ) : (
        <PeerPicker
          withIslands
          itemIds={displayedIds}
          filterValue={searchQuery}
          filterPlaceholder={lang('Search')}
          onSelectedIdChange={handleSelectedIdChange}
          onFilterChange={setSearchQuery}
          isSearchable
          withDefaultPadding
          withStatus
          subheader={requirementsSubheader}
        />
      )}
      <ConfirmDialog
        confirmLabel={lang('Send')}
        isOpen={isConfirmOpen}
        onClose={handleConfirmClose}
        confirmHandler={handleConfirmSend}
      >
        <p>{confirmText}</p>
      </ConfirmDialog>
    </PickerModal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const botCommonChats = modal ? selectUserCommonChats(global, modal.botId) : undefined;

    return {
      activeListIds: global.chats.listIds.active,
      archivedListIds: global.chats.listIds.archived,
      contactUserIds: global.contactList?.userIds,
      usersById: global.users.byId,
      chatsById: global.chats.byId,
      chatFullInfosById: global.chats.fullInfoById,
      botCommonChatIds: botCommonChats?.ids,
      areBotCommonChatsFullyLoaded: botCommonChats?.isFullyLoaded,
    };
  },
)(RequestPeerModal));

function isUserMatchingType(user: ApiUser, peerType: Extract<ApiRequestPeerType, { type: 'user' }>) {
  if (peerType.isBot !== undefined && peerType.isBot !== isUserBot(user)) {
    return false;
  }

  if (peerType.isPremium !== undefined && peerType.isPremium !== Boolean(user.isPremium)) {
    return false;
  }

  return true;
}

function isChatMatchingType(
  chat: ApiChat,
  peerType: Exclude<ApiRequestPeerType, { type: 'user' }>,
  botCommonChatIds: Set<string>,
  botMember?: ApiChatMember,
  canBotJoinGroups?: boolean,
) {
  if (chat.isMonoforum || chat.migratedTo) {
    return false;
  }

  if (peerType.type === 'group' && !isChatGroup(chat)) {
    return false;
  }

  if (peerType.type === 'channel' && !isChatChannel(chat)) {
    return false;
  }

  if (peerType.isCreator && !chat.isOwner) {
    return false;
  }

  if (peerType.hasUsername !== undefined && peerType.hasUsername !== Boolean(isChatPublic(chat))) {
    return false;
  }

  if (peerType.type === 'group' && peerType.isForum !== undefined && peerType.isForum !== Boolean(chat.isForum)) {
    return false;
  }

  if (peerType.userAdminRights && !hasAllAdminRights(chat, peerType.userAdminRights)) {
    return false;
  }

  if (peerType.botAdminRights && !getCanBotObtainRights(chat, peerType.botAdminRights, botMember)) {
    return false;
  }

  if (peerType.type === 'group' && peerType.isBotParticipant && !botCommonChatIds.has(chat.id)
    && (!canBotJoinGroups || !getCanAddBots(chat))) {
    return false;
  }

  return true;
}

function hasAllAdminRights(chat: ApiChat, requiredRights: ApiChatAdminRights) {
  return (Object.keys(requiredRights) as (keyof ApiChatAdminRights)[]).every((key) => (
    !requiredRights[key] || getHasAdminRight(chat, key)
  ));
}

function getCanBotObtainRights(chat: ApiChat, requiredRights: ApiChatAdminRights, botMember?: ApiChatMember) {
  if (chat.isOwner) {
    return true;
  }

  if (getHasAdminRight(chat, 'addAdmins') && hasAllAdminRights(chat, requiredRights)) {
    return true;
  }

  const botRights = botMember?.adminRights;
  if (!botRights) {
    return false;
  }

  return (Object.keys(requiredRights) as (keyof ApiChatAdminRights)[]).every((key) => (
    !requiredRights[key] || botRights[key]
  ));
}

function formatAdminRights(lang: LangFn, rights: ApiChatAdminRights, isChannel?: boolean) {
  const labels = (Object.keys(rights) as (keyof ApiChatAdminRights)[])
    .filter((key) => rights[key])
    .map((key) => (
      (isChannel ? CHANNEL_ADMIN_RIGHT_LANG_KEYS[key] : undefined)
      || (key !== 'other' ? ADMIN_RIGHT_LANG_KEYS[key] : undefined)
    ))
    .filter(Boolean)
    .map((key) => lang(key));

  return lang.conjunction(labels);
}

function getCanAddBots(chat: ApiChat) {
  return chat.isOwner
    || getHasAdminRight(chat, 'inviteUsers')
    || !isUserRightBanned(chat, 'inviteUsers');
}
