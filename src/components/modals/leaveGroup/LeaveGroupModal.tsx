import {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiChatFullInfo, ApiPeer } from '../../../api/types';
import type { GlobalState, TabState } from '../../../global/types';

import { getPeerTitle } from '../../../global/helpers/peers';
import { selectChat, selectChatFullInfo, selectPeer } from '../../../global/selectors';

import useSelector from '../../../hooks/data/useSelector';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import usePeerSearch, { prepareChatMemberSearch } from '../../../hooks/usePeerSearch';

import PasswordConfirmModal from '../../common/PasswordConfirmModal';
import PeerPicker, { type PeerPickerSection } from '../../common/pickers/PeerPicker';
import PickerModal from '../../common/pickers/PickerModal';
import TransferBetweenPeers from '../../common/TransferBetweenPeers';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './LeaveGroupModal.module.scss';

export type OwnProps = {
  modal: TabState['leaveGroupModal'];
};

type StateProps = {
  chat?: ApiChat;
  currentUser?: ApiPeer;
  currentUserId?: string;
  nextOwner?: ApiPeer;
  chatFullInfo?: ApiChatFullInfo;
};

const LeaveGroupModal = ({
  modal,
  chat,
  currentUser,
  currentUserId,
  nextOwner,
  chatFullInfo,
}: OwnProps & StateProps) => {
  const {
    closeLeaveGroupModal, leaveChannel, loadMoreMembers, loadFullChat,
    transferChannelOwnership, verifyTransferOwnership, openTwoFaCheckModal,
  } = getActions();
  const lang = useLang();

  const [isPickerOpen, openPicker, closePicker] = useFlag();
  const [isPasswordModalOpen, openPasswordModal, closePasswordModal] = useFlag();
  const [newOwnerId, setNewOwnerId] = useState<string | undefined>(modal?.nextOwnerId);
  const [search, setSearch] = useState('');

  const isOpen = Boolean(modal);
  const renderingChat = useCurrentOrPrev(chat);
  const renderingCurrentUser = useCurrentOrPrev(currentUser);

  useEffect(() => {
    if (chat && !chatFullInfo) {
      loadFullChat({ chatId: chat.id });
    }
  }, [chat, chatFullInfo]);

  const newOwner = (!newOwnerId || newOwnerId === modal?.nextOwnerId) ? nextOwner : undefined;

  const renderingNewOwner = useCurrentOrPrev(newOwner);

  const selectNewOwnerPeer = useCallback((global: GlobalState) => {
    return newOwnerId ? selectPeer(global, newOwnerId) : undefined;
  }, [newOwnerId]);
  const selectedNewOwnerPeer = useSelector(selectNewOwnerPeer);
  const newOwnerPeer = selectedNewOwnerPeer || renderingNewOwner;

  const { adminIds, memberIds, allIds } = useMemo(() => {
    if (!currentUserId) {
      return { adminIds: [], memberIds: [], allIds: [] };
    }

    const adminMembersById = chatFullInfo?.adminMembersById;
    const allMembers = chatFullInfo?.members;

    const adminUserIds = adminMembersById
      ? Object.values(adminMembersById)
        .filter((member) => member.userId !== currentUserId && !member.isOwner)
        .map((member) => member.userId)
      : [];

    const memberUserIds = (allMembers || [])
      .filter((member) => {
        return member.userId !== currentUserId
          && !member.isOwner
          && !member.isAdmin;
      })
      .map((member) => member.userId);

    return {
      adminIds: adminUserIds,
      memberIds: memberUserIds,
      allIds: [...adminUserIds, ...memberUserIds],
    };
  }, [currentUserId, chatFullInfo]);

  const hasAdmins = adminIds.length > 0;

  const isOwnerChanged = Boolean(newOwnerId && newOwnerId !== modal?.nextOwnerId);

  const memberSearchFn = useMemo(() => {
    return chat ? prepareChatMemberSearch(chat) : undefined;
  }, [chat]);

  const { result: searchResults, isLoading: isSearchLoading } = usePeerSearch({
    query: search,
    queryFn: memberSearchFn,
    defaultValue: allIds,
    isDisabled: !chat,
  });

  const { sections, filteredIds } = useMemo(() => {
    if (search) {
      const filtered = (searchResults || []).filter((id) => id !== currentUserId && allIds.includes(id));
      return { sections: undefined, filteredIds: filtered };
    }

    if (!hasAdmins) {
      return { sections: undefined, filteredIds: allIds };
    }

    const hasMembers = memberIds.length > 0;
    if (!hasMembers) {
      return {
        sections: undefined,
        filteredIds: adminIds,
      };
    }

    return {
      sections: [
        { key: 'admins', title: lang('LeaveGroupAdmins'), ids: adminIds },
        { key: 'members', title: lang('LeaveGroupMembers'), ids: memberIds },
      ] as PeerPickerSection[],
      filteredIds: allIds,
    };
  }, [search, searchResults, currentUserId, allIds, hasAdmins, adminIds, memberIds, lang]);

  const pickerTitle = lang('LeaveGroupAppointOwner');

  const handleLeave = useLastCallback(() => {
    const chatId = modal?.chatId;
    if (!chatId) return;

    if (isOwnerChanged && newOwnerId) {
      verifyTransferOwnership({
        chatId,
        userId: newOwnerId,
        onSuccess: openPasswordModal,
        onPasswordMissing: openTwoFaCheckModal,
        onPasswordTooFresh: openTwoFaCheckModal,
        onSessionTooFresh: openTwoFaCheckModal,
      });
    } else {
      openPasswordModal();
    }
  });

  const handleLeaveAndTransfer = useLastCallback((password: string) => {
    const chatId = modal?.chatId;
    if (!chatId) return;

    if (isOwnerChanged && newOwnerId) {
      transferChannelOwnership({
        chatId,
        userId: newOwnerId,
        password,
        onSuccess: () => leaveChannel({ chatId, shouldSkipOwnershipCheck: true }),
      });
    } else {
      leaveChannel({ chatId, shouldSkipOwnershipCheck: true });
    }
    closeLeaveGroupModal();
  });

  const handleAppointOwner = useLastCallback(() => {
    openPicker();
  });

  const handleSelectNewOwner = useLastCallback((userId: string) => {
    setNewOwnerId(userId);
    closePicker();
  });

  const handleClosePicker = useLastCallback(() => {
    closePicker();
  });

  const handleLoadMore = useLastCallback(() => {
    if (modal?.chatId) {
      loadMoreMembers({ chatId: modal.chatId });
    }
  });

  if (!renderingChat || !renderingCurrentUser) return undefined;

  const chatTitle = getPeerTitle(lang, renderingChat);
  const newOwnerName = newOwnerPeer ? getPeerTitle(lang, newOwnerPeer) : undefined;

  return (
    <>
      <Modal
        isOpen={isOpen && !isPickerOpen && !isPasswordModalOpen}
        dialogClassName={styles.dialog}
        onClose={closeLeaveGroupModal}
      >
        {newOwnerPeer && (
          <TransferBetweenPeers fromPeer={renderingCurrentUser} toPeer={newOwnerPeer} />
        )}
        <h3>{lang('LeaveGroupTitle', { group: chatTitle })}</h3>
        <p>
          {lang('LeaveGroupDescription', {
            nextOwner: newOwnerName,
            group: chatTitle,
          }, {
            withNodes: true,
            withMarkdown: true,
          })}
        </p>
        <div className="dialog-buttons-column">
          <Button
            color="danger"
            className="confirm-dialog-button"
            isText
            onClick={handleLeave}
          >
            {lang('GroupLeaveGroup')}
          </Button>
          {allIds.length > 0 && (
            <Button
              className="confirm-dialog-button"
              isText
              onClick={handleAppointOwner}
            >
              {lang('LeaveGroupAppointOwner')}
            </Button>
          )}
          <Button className="confirm-dialog-button" isText onClick={() => closeLeaveGroupModal()}>
            {lang('Cancel')}
          </Button>
        </div>
      </Modal>
      <PickerModal
        isOpen={isPickerOpen}
        title={pickerTitle}
        hasCloseButton
        shouldAdaptToSearch
        withFixedHeight
        onClose={handleClosePicker}
      >
        {sections ? (
          <PeerPicker
            sections={sections}
            filterValue={search}
            filterPlaceholder={lang('Search')}
            isSearchable
            isLoading={isSearchLoading}
            withStatus
            withDefaultPadding
            onFilterChange={setSearch}
            onSelectedIdChange={handleSelectNewOwner}
            onLoadMore={handleLoadMore}
          />
        ) : (
          <PeerPicker
            itemIds={filteredIds}
            filterValue={search}
            filterPlaceholder={lang('Search')}
            isSearchable
            isLoading={isSearchLoading}
            withStatus
            withDefaultPadding
            onFilterChange={setSearch}
            onSelectedIdChange={handleSelectNewOwner}
            onLoadMore={handleLoadMore}
          />
        )}
      </PickerModal>
      <PasswordConfirmModal
        isOpen={isPasswordModalOpen}
        title={lang('EnterPassword')}
        confirmLabel={lang('Transfer')}
        description={lang('EnterPasswordDescription')}
        onClose={closePasswordModal}
        onSubmit={handleLeaveAndTransfer}
      />
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const chat = modal?.chatId ? selectChat(global, modal.chatId) : undefined;
    const currentUser = global.currentUserId ? selectPeer(global, global.currentUserId) : undefined;
    const nextOwner = modal?.nextOwnerId ? selectPeer(global, modal.nextOwnerId) : undefined;
    const fullInfo = modal?.chatId ? selectChatFullInfo(global, modal.chatId) : undefined;

    return {
      chat,
      currentUser,
      currentUserId: global.currentUserId,
      nextOwner,
      chatFullInfo: fullInfo,
    };
  },
)(LeaveGroupModal));
