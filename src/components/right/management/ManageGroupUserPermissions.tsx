import React, {
  FC, memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../modules';

import { ApiChat, ApiChatBannedRights } from '../../../api/types';
import { ManagementScreens } from '../../../types';

import { selectChat } from '../../../modules/selectors';
import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import ListItem from '../../ui/ListItem';
import Checkbox from '../../ui/Checkbox';
import FloatingActionButton from '../../ui/FloatingActionButton';
import Spinner from '../../ui/Spinner';
import ConfirmDialog from '../../ui/ConfirmDialog';

type OwnProps = {
  chatId: string;
  selectedChatMemberId?: string;
  isPromotedByCurrentUser?: boolean;
  onScreenSelect: (screen: ManagementScreens) => void;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  chat?: ApiChat;
  isFormFullyDisabled?: boolean;
};

const ManageGroupUserPermissions: FC<OwnProps & StateProps> = ({
  chat,
  selectedChatMemberId,
  onScreenSelect,
  isFormFullyDisabled,
  onClose,
  isActive,
}) => {
  const { updateChatMemberBannedRights } = getActions();

  const [permissions, setPermissions] = useState<ApiChatBannedRights>({});
  const [havePermissionChanged, setHavePermissionChanged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBanConfirmationDialogOpen, openBanConfirmationDialog, closeBanConfirmationDialog] = useFlag();
  const lang = useLang();

  useHistoryBack(isActive, onClose);

  const selectedChatMember = useMemo(() => {
    if (!chat || !chat.fullInfo || !chat.fullInfo.members) {
      return undefined;
    }

    return chat.fullInfo.members.find(({ userId }) => userId === selectedChatMemberId);
  }, [chat, selectedChatMemberId]);

  useEffect(() => {
    if (chat?.fullInfo && selectedChatMemberId && !selectedChatMember) {
      onScreenSelect(ManagementScreens.GroupPermissions);
    }
  }, [chat, onScreenSelect, selectedChatMember, selectedChatMemberId]);

  useEffect(() => {
    setPermissions((selectedChatMember?.bannedRights) || (chat?.defaultBannedRights) || {});
    setHavePermissionChanged(false);
    setIsLoading(false);
  }, [chat, selectedChatMember]);

  const handlePermissionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name } = e.target;

    function getUpdatedPermissionValue(value: true | undefined) {
      return value ? undefined : true;
    }

    setPermissions((p) => ({
      ...p,
      [name]: getUpdatedPermissionValue(p[name as Exclude<keyof ApiChatBannedRights, 'untilDate'>]),
      ...(name === 'sendStickers' && {
        sendGifs: getUpdatedPermissionValue(p[name]),
      }),
    }));
    setHavePermissionChanged(true);
  }, []);

  const handleSavePermissions = useCallback(() => {
    if (!chat || !selectedChatMemberId) {
      return;
    }

    setIsLoading(true);
    updateChatMemberBannedRights({
      chatId: chat.id,
      userId: selectedChatMemberId,
      bannedRights: permissions,
    });
  }, [chat, selectedChatMemberId, permissions, updateChatMemberBannedRights]);

  const handleBanFromGroup = useCallback(() => {
    if (!chat || !selectedChatMemberId) {
      return;
    }

    updateChatMemberBannedRights({
      chatId: chat.id,
      userId: selectedChatMemberId,
      bannedRights: {
        viewMessages: true,
      },
    });
  }, [chat, selectedChatMemberId, updateChatMemberBannedRights]);

  const getControlIsDisabled = useCallback((key: Exclude<keyof ApiChatBannedRights, 'untilDate'>) => {
    if (isFormFullyDisabled) {
      return true;
    }

    if (!chat || !chat.defaultBannedRights) {
      return false;
    }

    return chat.defaultBannedRights[key];
  }, [chat, isFormFullyDisabled]);

  if (!selectedChatMember) {
    return undefined;
  }

  return (
    <div className="Management">
      <div className="custom-scroll">
        <div className="section">
          <ListItem inactive className="chat-item-clickable">
            <PrivateChatInfo userId={selectedChatMember.userId} />
          </ListItem>

          <h3 className="section-heading mt-4" dir="auto">{lang('UserRestrictionsCanDo')}</h3>

          <div className="ListItem no-selection">
            <Checkbox
              name="sendMessages"
              checked={!permissions.sendMessages}
              label={lang('UserRestrictionsSend')}
              blocking
              disabled={getControlIsDisabled('sendMessages')}
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem no-selection">
            <Checkbox
              name="sendMedia"
              checked={!permissions.sendMedia}
              label={lang('UserRestrictionsSendMedia')}
              blocking
              disabled={getControlIsDisabled('sendMedia')}
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem no-selection">
            <Checkbox
              name="sendStickers"
              checked={!permissions.sendStickers && !permissions.sendGifs}
              label={lang('UserRestrictionsSendStickers')}
              blocking
              disabled={getControlIsDisabled('sendStickers')}
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem no-selection">
            <Checkbox
              name="sendPolls"
              checked={!permissions.sendPolls}
              label={lang('UserRestrictionsSendPolls')}
              blocking
              disabled={getControlIsDisabled('sendPolls')}
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem no-selection">
            <Checkbox
              name="embedLinks"
              checked={!permissions.embedLinks}
              label={lang('UserRestrictionsEmbedLinks')}
              blocking
              disabled={getControlIsDisabled('embedLinks')}
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem no-selection">
            <Checkbox
              name="inviteUsers"
              checked={!permissions.inviteUsers}
              label={lang('UserRestrictionsInviteUsers')}
              blocking
              disabled={getControlIsDisabled('inviteUsers')}
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem no-selection">
            <Checkbox
              name="pinMessages"
              checked={!permissions.pinMessages}
              label={lang('UserRestrictionsPinMessages')}
              blocking
              disabled={getControlIsDisabled('pinMessages')}
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem no-selection">
            <Checkbox
              name="changeInfo"
              checked={!permissions.changeInfo}
              label={lang('UserRestrictionsChangeInfo')}
              blocking
              disabled={getControlIsDisabled('changeInfo')}
              onChange={handlePermissionChange}
            />
          </div>
        </div>

        {!isFormFullyDisabled && (
          <div className="section">
            <ListItem icon="delete-user" ripple destructive onClick={openBanConfirmationDialog}>
              {lang('UserRestrictionsBlock')}
            </ListItem>
          </div>
        )}
      </div>

      <FloatingActionButton
        isShown={havePermissionChanged}
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
        isOpen={isBanConfirmationDialogOpen}
        onClose={closeBanConfirmationDialog}
        text="Are you sure you want to ban and remove this user from the group?"
        confirmLabel="Remove"
        confirmHandler={handleBanFromGroup}
        confirmIsDestructive
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, isPromotedByCurrentUser }): StateProps => {
    const chat = selectChat(global, chatId)!;
    const isFormFullyDisabled = !(chat.isCreator || isPromotedByCurrentUser);

    return { chat, isFormFullyDisabled };
  },
)(ManageGroupUserPermissions));
