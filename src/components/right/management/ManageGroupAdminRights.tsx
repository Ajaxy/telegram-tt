import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiChat, ApiChatAdminRights, ApiChatMember, ApiUser,
} from '../../../api/types';
import { ManagementScreens } from '../../../types';

import { getUserFullName, isChatBasicGroup, isChatChannel } from '../../../global/helpers';
import { selectChat, selectChatFullInfo } from '../../../global/selectors';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import Checkbox from '../../ui/Checkbox';
import ConfirmDialog from '../../ui/ConfirmDialog';
import FloatingActionButton from '../../ui/FloatingActionButton';
import InputText from '../../ui/InputText';
import ListItem from '../../ui/ListItem';
import Spinner from '../../ui/Spinner';

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
  adminMembersById?: Record<string, ApiChatMember>;
  hasFullInfo: boolean;
  currentUserId?: string;
  isChannel: boolean;
  isFormFullyDisabled: boolean;
  isForum?: boolean;
  defaultRights?: ApiChatAdminRights;
};

const CUSTOM_TITLE_MAX_LENGTH = 16;

const ManageGroupAdminRights: FC<OwnProps & StateProps> = ({
  isActive,
  isNewAdmin,
  selectedUserId,
  defaultRights,
  chat,
  usersById,
  currentUserId,
  adminMembersById,
  hasFullInfo,
  isChannel,
  isForum,
  isFormFullyDisabled,
  onClose,
  onScreenSelect,
}) => {
  const { updateChatAdmin } = getActions();

  const [permissions, setPermissions] = useState<ApiChatAdminRights>({});
  const [isTouched, setIsTouched] = useState(Boolean(isNewAdmin));
  const [isLoading, setIsLoading] = useState(false);
  const [isDismissConfirmationDialogOpen, openDismissConfirmationDialog, closeDismissConfirmationDialog] = useFlag();
  const [customTitle, setCustomTitle] = useState('');
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  const selectedChatMember = useMemo(() => {
    const selectedAdminMember = selectedUserId ? adminMembersById?.[selectedUserId] : undefined;

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
        customTitle: lang('ChannelAdmin'),
        isOwner: false,
        promotedByUserId: undefined,
      } : undefined;
    }

    return selectedAdminMember;
  }, [adminMembersById, defaultRights, isNewAdmin, lang, selectedUserId]);

  useEffect(() => {
    if (hasFullInfo && selectedUserId && !selectedChatMember) {
      onScreenSelect(ManagementScreens.ChatAdministrators);
    }
  }, [chat, hasFullInfo, onScreenSelect, selectedChatMember, selectedUserId]);

  useEffect(() => {
    setPermissions(selectedChatMember?.adminRights || {});
    setCustomTitle((selectedChatMember?.customTitle || '').substr(0, CUSTOM_TITLE_MAX_LENGTH));
    setIsTouched(Boolean(isNewAdmin));
    setIsLoading(false);
  }, [defaultRights, isNewAdmin, selectedChatMember]);

  const handlePermissionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name } = e.target;

    function getUpdatedPermissionValue(value: true | undefined) {
      return value ? undefined : true;
    }

    setPermissions((p) => ({
      ...p,
      [name]: getUpdatedPermissionValue(p[name as keyof ApiChatAdminRights]),
    }));
    setIsTouched(true);
  }, []);

  const handleSavePermissions = useCallback(() => {
    if (!selectedUserId) {
      return;
    }

    setIsLoading(true);
    updateChatAdmin({
      chatId: chat.id,
      userId: selectedUserId,
      adminRights: permissions,
      customTitle,
    });
  }, [selectedUserId, updateChatAdmin, chat.id, permissions, customTitle]);

  const handleDismissAdmin = useCallback(() => {
    if (!selectedUserId) {
      return;
    }

    updateChatAdmin({
      chatId: chat.id,
      userId: selectedUserId,
      adminRights: {},
    });
    closeDismissConfirmationDialog();
  }, [chat.id, closeDismissConfirmationDialog, selectedUserId, updateChatAdmin]);

  const getControlIsDisabled = useCallback((key: keyof ApiChatAdminRights) => {
    if (isChatBasicGroup(chat)) {
      return false;
    }

    if (isFormFullyDisabled || !chat.adminRights) {
      return true;
    }

    if (chat.isCreator) {
      return false;
    }

    return !chat.adminRights![key];
  }, [chat, isFormFullyDisabled]);

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
      return lang('EditAdminPromotedBy', getUserFullName(promotedByUser));
    }

    return lang('ChannelAdmin');
  }, [isNewAdmin, selectedChatMember, usersById, lang]);

  const handleCustomTitleChange = useCallback((e) => {
    const { value } = e.target;
    setCustomTitle(value);
    setIsTouched(true);
  }, []);

  if (!selectedChatMember) {
    return undefined;
  }

  return (
    <div className="Management">
      <div className="custom-scroll">
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
          {isChannel && (
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
          )}
          {isChannel && (
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
          )}
          {isChannel && (
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
          )}
          {!isChannel && (
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
          )}
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
                label={lang('ManageTopicsPermission')}
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
              {lang('Channel.EditAdmin.CannotEdit')}
            </p>
          )}

          {!isChannel && (
            <InputText
              id="admin-title"
              label={lang('EditAdminRank')}
              onChange={handleCustomTitleChange}
              value={customTitle}
              disabled={isFormFullyDisabled}
              maxLength={CUSTOM_TITLE_MAX_LENGTH}
            />
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
      >
        {isLoading ? (
          <Spinner color="white" />
        ) : (
          <i className="icon icon-check" />
        )}
      </FloatingActionButton>

      {!isNewAdmin && (
        <ConfirmDialog
          isOpen={isDismissConfirmationDialogOpen}
          onClose={closeDismissConfirmationDialog}
          text="Are you sure you want to dismiss this admin?"
          confirmLabel={lang('Channel.Admin.Dismiss')}
          confirmHandler={handleDismissAdmin}
          confirmIsDestructive
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, isPromotedByCurrentUser }): StateProps => {
    const chat = selectChat(global, chatId)!;
    const fullInfo = selectChatFullInfo(global, chatId);
    const { byId: usersById } = global.users;
    const { currentUserId } = global;
    const isChannel = isChatChannel(chat);
    const isFormFullyDisabled = !(chat.isCreator || isPromotedByCurrentUser);
    const isForum = chat.isForum;

    return {
      chat,
      usersById,
      currentUserId,
      isChannel,
      isForum,
      isFormFullyDisabled,
      defaultRights: chat.adminRights,
      hasFullInfo: Boolean(fullInfo),
      adminMembersById: fullInfo?.adminMembersById,
    };
  },
)(ManageGroupAdminRights));
