import {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiChat, ApiChatAdminRights, ApiChatMember, ApiUser,
} from '../../../api/types';
import { ManagementScreens } from '../../../types';

import { getUserFullName, isChatBasicGroup, isChatChannel, isUserBot } from '../../../global/helpers';
import { selectCanEditRank, selectChat, selectChatFullInfo } from '../../../global/selectors';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import PasswordConfirmModal from '../../common/PasswordConfirmModal';
import PrivateChatInfo from '../../common/PrivateChatInfo';
import Checkbox from '../../ui/Checkbox';
import ConfirmDialog from '../../ui/ConfirmDialog';
import FloatingActionButton from '../../ui/FloatingActionButton';
import InputText from '../../ui/InputText';
import ListItem from '../../ui/ListItem';

type OwnProps = {
  chatId: string;
  selectedUserId?: string;
  isPromotedByCurrentUser?: boolean;
  isNewAdmin?: boolean;
  isActive: boolean;
  onScreenSelect: (screen: ManagementScreens) => void;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  chat: ApiChat;
  usersById: Record<string, ApiUser>;
  selectedAdminMember?: ApiChatMember;
  hasFullInfo: boolean;
  currentUserId?: string;
  isFormFullyDisabled: boolean;
  defaultRights?: ApiChatAdminRights;
  canEditRank?: boolean;
};

const CUSTOM_TITLE_MAX_LENGTH = 16;

const ManageGroupAdminRights = ({
  isActive,
  isNewAdmin,
  selectedUserId,
  defaultRights,
  chat,
  usersById,
  currentUserId,
  selectedAdminMember,
  hasFullInfo,
  isFormFullyDisabled,
  canEditRank,
  onClose,
  onScreenSelect,
}: OwnProps & StateProps) => {
  const {
    updateChatAdmin, transferChatOwnership, showNotification,
    openTwoFaCheckModal, verifyTransferOwnership,
  } = getActions();

  const [permissions, setPermissions] = useState<ApiChatAdminRights>({});
  const [isTouched, setIsTouched] = useState(Boolean(isNewAdmin));
  const [isLoading, setIsLoading] = useState(false);
  const [isDismissConfirmationDialogOpen, openDismissConfirmationDialog, closeDismissConfirmationDialog] = useFlag();
  const [isTransferDialogOpen, openTransferDialog, closeTransferDialog] = useFlag();
  const [isPasswordModalOpen, openPasswordModal, closePasswordModal] = useFlag();
  const [rank, setRank] = useState('');
  const lang = useLang();

  const isChannel = isChatChannel(chat);
  const isForum = chat.isForum;
  const hasDirectMessages = Boolean(chat.linkedMonoforumId);

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  const selectedChatMember: ApiChatMember | undefined = useMemo(() => {
    // If `selectedAdminMember` variable is filled with a value, then we have already saved the administrator,
    // so now we need to return to the list of administrators
    if (isNewAdmin && (selectedAdminMember || !selectedUserId)) {
      return undefined;
    }

    if (isNewAdmin) {
      const user = getGlobal().users.byId[selectedUserId!];

      return user ? {
        userId: user.id,
        adminRights: defaultRights,
        rank: lang('ChannelAdmin'),
        isOwner: undefined,
        promotedByUserId: undefined,
      } : undefined;
    }

    return selectedAdminMember;
  }, [selectedAdminMember, defaultRights, isNewAdmin, lang, selectedUserId]);

  useEffect(() => {
    if (hasFullInfo && selectedUserId && !selectedChatMember) {
      onScreenSelect(ManagementScreens.ChatAdministrators);
    }
  }, [chat, hasFullInfo, onScreenSelect, selectedChatMember, selectedUserId]);

  useEffect(() => {
    setPermissions(selectedChatMember?.adminRights || {});
    setRank((selectedChatMember?.rank || '').slice(0, CUSTOM_TITLE_MAX_LENGTH));
    setIsTouched(Boolean(isNewAdmin));
    setIsLoading(false);
  }, [defaultRights, isNewAdmin, selectedChatMember]);

  const handlePermissionChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name } = e.target;

    function getUpdatedPermissionValue(value: true | undefined) {
      return value ? undefined : true;
    }

    setPermissions((p) => ({
      ...p,
      [name]: getUpdatedPermissionValue(p[name as keyof ApiChatAdminRights]),
    }));
    setIsTouched(true);
  });

  const handleSavePermissions = useLastCallback(() => {
    if (!selectedUserId) {
      return;
    }
    const hasRankChanged = rank !== selectedAdminMember?.rank;

    setIsLoading(true);
    updateChatAdmin({
      chatId: chat.id,
      userId: selectedUserId,
      adminRights: permissions,
      rank: hasRankChanged ? rank : undefined,
    });
  });

  const handleDismissAdmin = useLastCallback(() => {
    if (!selectedUserId) {
      return;
    }

    updateChatAdmin({
      chatId: chat.id,
      userId: selectedUserId,
      adminRights: {},
    });
    closeDismissConfirmationDialog();
  });

  const getControlIsDisabled = useLastCallback((key: keyof ApiChatAdminRights) => {
    if (isChatBasicGroup(chat)) {
      return false;
    }

    if (isFormFullyDisabled || !chat.adminRights) {
      return true;
    }

    if (chat.isCreator) {
      return false;
    }

    return !chat.adminRights[key];
  });

  const memberStatus = useMemo(() => {
    if (isNewAdmin || !selectedChatMember) {
      return undefined;
    }

    if (selectedChatMember.isOwner) {
      return lang('ChannelCreator');
    }

    const promotedByUser = selectedChatMember.promotedByUserId
      ? usersById[selectedChatMember.promotedByUserId]
      : undefined;

    if (promotedByUser) {
      return lang('EditAdminPromotedBy', { user: getUserFullName(promotedByUser) });
    }

    return lang('ChannelAdmin');
  }, [isNewAdmin, selectedChatMember, usersById, lang]);

  const handleRankChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setRank(value);
    setIsTouched(true);
  });

  const handleStartTransfer = useLastCallback(() => {
    if (!selectedUserId) return;

    verifyTransferOwnership({
      chatId: chat.id,
      userId: selectedUserId,
      onSuccess: openTransferDialog,
      onPasswordMissing: openTwoFaCheckModal,
      onPasswordTooFresh: openTwoFaCheckModal,
      onSessionTooFresh: openTwoFaCheckModal,
    });
  });

  const handleConfirmTransfer = useLastCallback(() => {
    closeTransferDialog();
    openPasswordModal();
  });

  const handleTransferOwnership = useLastCallback((password: string) => {
    if (!selectedUserId) return;

    const user = usersById[selectedUserId];
    const userName = user ? getUserFullName(user) : '';

    transferChatOwnership({
      chatId: chat.id,
      userId: selectedUserId,
      password,
      onSuccess: () => {
        showNotification({
          message: lang(
            isChannel ? 'EditAdminTransferChannelOwnershipSuccess' : 'EditAdminTransferGroupOwnershipSuccess',
            { user: userName },
          ),
        });
      },
    });

    closePasswordModal();
  });

  const selectedUser = selectedUserId ? usersById[selectedUserId] : undefined;
  const canTransferOwnership = Boolean(
    chat.isCreator && selectedUser && !isUserBot(selectedUser) && selectedUserId !== currentUserId,
  );

  if (!selectedChatMember) {
    return undefined;
  }

  return (
    <div className="Management">
      <div className="panel-content custom-scroll">
        <div className="section">
          <ListItem inactive className="chat-item-clickable">
            <PrivateChatInfo
              userId={selectedChatMember.userId}
              status={memberStatus}
              forceShowSelf
            />
          </ListItem>

          <h3 className="section-heading mt-4" dir="auto">{lang('EditAdminWhatCanDo')}</h3>

          <div className="ListItem">
            <Checkbox
              name="changeInfo"
              checked={Boolean(permissions.changeInfo)}
              label={lang(isChannel ? 'EditAdminChangeChannelInfo' : 'EditAdminChangeGroupInfo')}
              blocking
              disabled={getControlIsDisabled('changeInfo')}
              onChange={handlePermissionChange}
            />
          </div>
          {isChannel && (
            <div className="ListItem">
              <Checkbox
                name="postMessages"
                checked={Boolean(permissions.postMessages)}
                label={lang('EditAdminPostMessages')}
                blocking
                disabled={getControlIsDisabled('postMessages')}
                onChange={handlePermissionChange}
              />
            </div>
          )}
          {isChannel && (
            <div className="ListItem">
              <Checkbox
                name="editMessages"
                checked={Boolean(permissions.editMessages)}
                label={lang('EditAdminEditMessages')}
                blocking
                disabled={getControlIsDisabled('editMessages')}
                onChange={handlePermissionChange}
              />
            </div>
          )}
          <div className="ListItem">
            <Checkbox
              name="deleteMessages"
              checked={Boolean(permissions.deleteMessages)}
              label={lang(isChannel ? 'EditAdminDeleteMessages' : 'EditAdminGroupDeleteMessages')}
              blocking
              disabled={getControlIsDisabled('deleteMessages')}
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem">
            <Checkbox
              name="postStories"
              checked={Boolean(permissions.postStories)}
              label={lang('EditAdminPostStories')}
              blocking
              disabled={getControlIsDisabled('postStories')}
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem">
            <Checkbox
              name="editStories"
              checked={Boolean(permissions.editStories)}
              label={lang('EditAdminEditStories')}
              blocking
              disabled={getControlIsDisabled('editStories')}
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem">
            <Checkbox
              name="deleteStories"
              checked={Boolean(permissions.deleteStories)}
              label={lang('EditAdminDeleteStories')}
              blocking
              disabled={getControlIsDisabled('deleteStories')}
              onChange={handlePermissionChange}
            />
          </div>
          {hasDirectMessages && (
            <div className="ListItem">
              <Checkbox
                name="manageDirectMessages"
                checked={Boolean(permissions.manageDirectMessages)}
                label={lang('EditAdminManageDirect')}
                blocking
                disabled={getControlIsDisabled('manageDirectMessages')}
                onChange={handlePermissionChange}
              />
            </div>
          )}
          <div className="ListItem">
            <Checkbox
              name="banUsers"
              checked={Boolean(permissions.banUsers)}
              label={lang('EditAdminBanUsers')}
              blocking
              disabled={getControlIsDisabled('banUsers')}
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem">
            <Checkbox
              name="inviteUsers"
              checked={Boolean(permissions.inviteUsers)}
              label={lang('EditAdminAddUsers')}
              blocking
              disabled={getControlIsDisabled('inviteUsers')}
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem">
            <Checkbox
              name="editRank"
              checked={Boolean(permissions.manageRanks)}
              label={lang('EditAdminEditRank')}
              blocking
              disabled={getControlIsDisabled('manageRanks')}
              onChange={handlePermissionChange}
            />
          </div>
          {!isChannel && (
            <div className="ListItem">
              <Checkbox
                name="pinMessages"
                checked={Boolean(permissions.pinMessages)}
                label={lang('EditAdminPinMessages')}
                blocking
                disabled={getControlIsDisabled('pinMessages')}
                onChange={handlePermissionChange}
              />
            </div>
          )}
          <div className="ListItem">
            <Checkbox
              name="addAdmins"
              checked={Boolean(permissions.addAdmins)}
              label={lang('EditAdminAddAdmins')}
              blocking
              disabled={getControlIsDisabled('addAdmins')}
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem">
            <Checkbox
              name="manageCall"
              checked={Boolean(permissions.manageCall)}
              label={lang('StartVoipChatPermission')}
              blocking
              disabled={getControlIsDisabled('manageCall')}
              onChange={handlePermissionChange}
            />
          </div>
          {isForum && (
            <div className="ListItem">
              <Checkbox
                name="manageTopics"
                checked={Boolean(permissions.manageTopics)}
                label={lang('EditAdminManageTopics')}
                blocking
                disabled={getControlIsDisabled('manageTopics')}
                onChange={handlePermissionChange}
              />
            </div>
          )}
          {!isChannel && (
            <div className="ListItem">
              <Checkbox
                name="anonymous"
                checked={Boolean(permissions.anonymous)}
                label={lang('EditAdminSendAnonymously')}
                blocking
                disabled={getControlIsDisabled('anonymous')}
                onChange={handlePermissionChange}
              />
            </div>
          )}

          {isFormFullyDisabled && (
            <p className="section-info mb-4" dir="auto">
              {lang('EditAdminUnavailable')}
            </p>
          )}

          {!isChannel && (
            <InputText
              id="admin-title"
              label={lang('EditAdminRank')}
              className="input-admin-title"
              onChange={handleRankChange}
              value={rank}
              disabled={isFormFullyDisabled || !canEditRank}
              maxLength={CUSTOM_TITLE_MAX_LENGTH}
            />
          )}

          {canTransferOwnership && currentUserId !== selectedUserId && !isFormFullyDisabled && !isNewAdmin && (
            <ListItem icon="key" ripple onClick={handleStartTransfer}>
              {lang(isChannel ? 'EditAdminTransferChannelOwnership' : 'EditAdminTransferGroupOwnership')}
            </ListItem>
          )}
          {currentUserId !== selectedUserId && !isFormFullyDisabled && !isNewAdmin && (
            <ListItem icon="delete" ripple destructive onClick={openDismissConfirmationDialog}>
              {lang('EditAdminRemoveAdmin')}
            </ListItem>
          )}
        </div>
      </div>

      <FloatingActionButton
        isShown={isTouched}
        onClick={handleSavePermissions}
        ariaLabel={lang('Save')}
        disabled={isLoading}
        iconName="check"
        isLoading={isLoading}
      />

      {!isNewAdmin && (
        <ConfirmDialog
          isOpen={isDismissConfirmationDialogOpen}
          onClose={closeDismissConfirmationDialog}
          text={lang('EditAdminConfirmDismissText')}
          confirmLabel={lang('EditAdminConfirmDismiss')}
          confirmHandler={handleDismissAdmin}
          confirmIsDestructive
        />
      )}
      <ConfirmDialog
        isOpen={isTransferDialogOpen}
        onClose={closeTransferDialog}
        title={lang(isChannel ? 'EditAdminTransferChannelOwnership' : 'EditAdminTransferGroupOwnership')}
        textParts={lang('EditAdminTransferOwnershipText', {
          chat: chat.title,
          user: selectedUserId ? getUserFullName(usersById[selectedUserId]) : '',
        }, { withNodes: true, withMarkdown: true })}
        confirmLabel={lang('EditAdminTransferChangeOwner')}
        confirmHandler={handleConfirmTransfer}
      />
      <PasswordConfirmModal
        isOpen={isPasswordModalOpen}
        title={lang(isChannel ? 'EditAdminTransferChannelOwnership' : 'EditAdminTransferGroupOwnership')}
        confirmLabel={lang('EditAdminTransferChangeOwner')}
        onClose={closePasswordModal}
        onSubmit={handleTransferOwnership}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, isPromotedByCurrentUser, selectedUserId }): Complete<StateProps> => {
    const chat = selectChat(global, chatId)!;
    const fullInfo = selectChatFullInfo(global, chatId);
    const { byId: usersById } = global.users;
    const { currentUserId } = global;
    const isFormFullyDisabled = !(chat.isCreator || isPromotedByCurrentUser);
    const adminMembersById = fullInfo?.adminMembersById;

    const selectedAdminMember = selectedUserId ? adminMembersById?.[selectedUserId] : undefined;
    const canEditRank = selectedAdminMember && selectCanEditRank(global, {
      chatId,
      userId: selectedAdminMember.userId,
      isAdmin: selectedAdminMember.isAdmin,
      isOwner: selectedAdminMember.isOwner,
    });

    return {
      chat,
      usersById,
      currentUserId,
      isFormFullyDisabled,
      defaultRights: chat.adminRights,
      hasFullInfo: Boolean(fullInfo),
      selectedAdminMember,
      canEditRank,
    };
  },
  (global, { chatId }) => {
    return Boolean(selectChat(global, chatId));
  },
)(ManageGroupAdminRights));
