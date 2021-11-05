import React, {
  FC, memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { ApiChat, ApiChatAdminRights, ApiUser } from '../../../api/types';
import { ManagementScreens } from '../../../types';
import { GlobalActions } from '../../../global/types';

import { pick } from '../../../util/iteratees';
import { selectChat } from '../../../modules/selectors';
import { getUserFullName, isChatBasicGroup, isChatChannel } from '../../../modules/helpers';
import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import ListItem from '../../ui/ListItem';
import Checkbox from '../../ui/Checkbox';
import FloatingActionButton from '../../ui/FloatingActionButton';
import Spinner from '../../ui/Spinner';
import ConfirmDialog from '../../ui/ConfirmDialog';
import InputText from '../../ui/InputText';

type OwnProps = {
  chatId: string;
  selectedChatMemberId?: string;
  isPromotedByCurrentUser?: boolean;
  onScreenSelect: (screen: ManagementScreens) => void;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  chat: ApiChat;
  usersById: Record<string, ApiUser>;
  currentUserId?: string;
  isChannel: boolean;
  isFormFullyDisabled: boolean;
};

type DispatchProps = Pick<GlobalActions, 'updateChatAdmin'>;

const CUSTOM_TITLE_MAX_LENGTH = 16;

const ManageGroupAdminRights: FC<OwnProps & StateProps & DispatchProps> = ({
  selectedChatMemberId,
  onScreenSelect,
  chat,
  usersById,
  currentUserId,
  isChannel,
  isFormFullyDisabled,
  updateChatAdmin,
  onClose,
  isActive,
}) => {
  const [permissions, setPermissions] = useState<ApiChatAdminRights>({});
  const [isTouched, setIsTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDismissConfirmationDialogOpen, openDismissConfirmationDialog, closeDismissConfirmationDialog] = useFlag();
  const [customTitle, setCustomTitle] = useState('');
  const lang = useLang();

  useHistoryBack(isActive, onClose);

  const selectedChatMember = useMemo(() => {
    if (!chat.fullInfo || !chat.fullInfo.adminMembers) {
      return undefined;
    }

    return chat.fullInfo.adminMembers.find(({ userId }) => userId === selectedChatMemberId);
  }, [chat, selectedChatMemberId]);

  useEffect(() => {
    if (chat?.fullInfo && selectedChatMemberId && !selectedChatMember) {
      onScreenSelect(ManagementScreens.ChatAdministrators);
    }
  }, [chat, onScreenSelect, selectedChatMember, selectedChatMemberId]);

  useEffect(() => {
    setPermissions((selectedChatMember?.adminRights) || {});
    setCustomTitle(((selectedChatMember?.customTitle) || '').substr(0, CUSTOM_TITLE_MAX_LENGTH));
    setIsTouched(false);
    setIsLoading(false);
  }, [selectedChatMember]);

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
    if (!selectedChatMemberId) {
      return;
    }

    setIsLoading(true);
    updateChatAdmin({
      chatId: chat.id,
      userId: selectedChatMemberId,
      adminRights: permissions,
      customTitle,
    });
  }, [chat, selectedChatMemberId, permissions, customTitle, updateChatAdmin]);

  const handleDismissAdmin = useCallback(() => {
    if (!selectedChatMemberId) {
      return;
    }

    updateChatAdmin({
      chatId: chat.id,
      userId: selectedChatMemberId,
      adminRights: {},
    });
    closeDismissConfirmationDialog();
  }, [chat.id, closeDismissConfirmationDialog, selectedChatMemberId, updateChatAdmin]);

  const getControlIsDisabled = useCallback((key: keyof ApiChatAdminRights) => {
    if (isChatBasicGroup(chat)) {
      return false;
    }

    if (isFormFullyDisabled || !chat.adminRights) {
      return true;
    }

    return !chat.adminRights![key];
  }, [chat, isFormFullyDisabled]);

  const memberStatus = useMemo(() => {
    if (!selectedChatMember) {
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
  }, [selectedChatMember, usersById, lang]);

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

          <div className="ListItem no-selection">
            <Checkbox
              name="changeInfo"
              checked={!!permissions.changeInfo}
              label={lang(isChannel ? 'EditAdminChangeChannelInfo' : 'EditAdminChangeGroupInfo')}
              blocking
              disabled={getControlIsDisabled('changeInfo')}
              onChange={handlePermissionChange}
            />
          </div>
          {isChannel && (
            <div className="ListItem no-selection">
              <Checkbox
                name="postMessages"
                checked={!!permissions.postMessages}
                label={lang('EditAdminPostMessages')}
                blocking
                disabled={getControlIsDisabled('postMessages')}
                onChange={handlePermissionChange}
              />
            </div>
          )}
          {isChannel && (
            <div className="ListItem no-selection">
              <Checkbox
                name="editMessages"
                checked={!!permissions.editMessages}
                label={lang('EditAdminEditMessages')}
                blocking
                disabled={getControlIsDisabled('editMessages')}
                onChange={handlePermissionChange}
              />
            </div>
          )}
          <div className="ListItem no-selection">
            <Checkbox
              name="deleteMessages"
              checked={!!permissions.deleteMessages}
              label={lang(isChannel ? 'EditAdminDeleteMessages' : 'EditAdminGroupDeleteMessages')}
              blocking
              disabled={getControlIsDisabled('deleteMessages')}
              onChange={handlePermissionChange}
            />
          </div>
          {!isChannel && (
            <div className="ListItem no-selection">
              <Checkbox
                name="banUsers"
                checked={!!permissions.banUsers}
                label={lang('EditAdminBanUsers')}
                blocking
                disabled={getControlIsDisabled('banUsers')}
                onChange={handlePermissionChange}
              />
            </div>
          )}
          <div className="ListItem no-selection">
            <Checkbox
              name="inviteUsers"
              checked={!!permissions.inviteUsers}
              label={lang('EditAdminAddUsers')}
              blocking
              disabled={getControlIsDisabled('inviteUsers')}
              onChange={handlePermissionChange}
            />
          </div>
          {!isChannel && (
            <div className="ListItem no-selection">
              <Checkbox
                name="pinMessages"
                checked={!!permissions.pinMessages}
                label={lang('EditAdminPinMessages')}
                blocking
                disabled={getControlIsDisabled('pinMessages')}
                onChange={handlePermissionChange}
              />
            </div>
          )}
          <div className="ListItem no-selection">
            <Checkbox
              name="addAdmins"
              checked={!!permissions.addAdmins}
              label={lang('EditAdminAddAdmins')}
              blocking
              disabled={getControlIsDisabled('addAdmins')}
              onChange={handlePermissionChange}
            />
          </div>
          {!isChannel && (
            <div className="ListItem no-selection">
              <Checkbox
                name="anonymous"
                checked={!!permissions.anonymous}
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

          {currentUserId !== selectedChatMemberId && !isFormFullyDisabled && (
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
          <i className="icon-check" />
        )}
      </FloatingActionButton>

      <ConfirmDialog
        isOpen={isDismissConfirmationDialogOpen}
        onClose={closeDismissConfirmationDialog}
        text="Are you sure you want to dismiss this admin?"
        confirmLabel="Dismiss"
        confirmHandler={handleDismissAdmin}
        confirmIsDestructive
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, isPromotedByCurrentUser }): StateProps => {
    const chat = selectChat(global, chatId)!;
    const { byId: usersById } = global.users;
    const { currentUserId } = global;
    const isChannel = isChatChannel(chat);
    const isFormFullyDisabled = !(chat.isCreator || isPromotedByCurrentUser);

    return {
      chat,
      usersById,
      currentUserId,
      isChannel,
      isFormFullyDisabled,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['updateChatAdmin']),
)(ManageGroupAdminRights));
