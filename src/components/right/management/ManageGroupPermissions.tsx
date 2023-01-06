import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { ManagementScreens } from '../../../types';
import type { ApiChat, ApiChatBannedRights, ApiChatMember } from '../../../api/types';

import useLang from '../../../hooks/useLang';
import { selectChat } from '../../../global/selectors';
import useHistoryBack from '../../../hooks/useHistoryBack';

import ListItem from '../../ui/ListItem';
import Checkbox from '../../ui/Checkbox';
import FloatingActionButton from '../../ui/FloatingActionButton';
import Spinner from '../../ui/Spinner';
import PrivateChatInfo from '../../common/PrivateChatInfo';

type OwnProps = {
  chatId: string;
  onScreenSelect: (screen: ManagementScreens) => void;
  onChatMemberSelect: (memberId: string, isPromotedByCurrentUser?: boolean) => void;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  chat?: ApiChat;
  currentUserId?: string;
};

const FLOATING_BUTTON_ANIMATION_TIMEOUT_MS = 250;

function getLangKeyForBannedRightKey(key: string) {
  switch (key) {
    case 'sendMessages':
      return 'UserRestrictionsNoSend';
    case 'sendMedia':
      return 'UserRestrictionsNoSendMedia';
    case 'sendStickers':
      return 'UserRestrictionsNoSendStickers';
    case 'embedLinks':
      return 'UserRestrictionsNoEmbedLinks';
    case 'sendPolls':
      return 'UserRestrictionsNoSendPolls';
    case 'changeInfo':
      return 'UserRestrictionsNoChangeInfo';
    case 'inviteUsers':
      return 'UserRestrictionsInviteUsers';
    case 'pinMessages':
      return 'UserRestrictionsPinMessages';
    case 'manageTopics':
      return 'GroupPermission.NoManageTopics';
    default:
      return undefined;
  }
}

const ManageGroupPermissions: FC<OwnProps & StateProps> = ({
  onScreenSelect,
  onChatMemberSelect,
  chat,
  currentUserId,
  onClose,
  isActive,
}) => {
  const { updateChatDefaultBannedRights } = getActions();

  const [permissions, setPermissions] = useState<ApiChatBannedRights>({});
  const [havePermissionChanged, setHavePermissionChanged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const lang = useLang();

  const { isForum } = chat || {};

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  const handleRemovedUsersClick = useCallback(() => {
    onScreenSelect(ManagementScreens.GroupRemovedUsers);
  }, [onScreenSelect]);

  const handleAddExceptionClick = useCallback(() => {
    onScreenSelect(ManagementScreens.GroupUserPermissionsCreate);
  }, [onScreenSelect]);

  const handleExceptionMemberClick = useCallback((member: ApiChatMember) => {
    onChatMemberSelect(member.userId, member.promotedByUserId === currentUserId);
    onScreenSelect(ManagementScreens.GroupUserPermissions);
  }, [currentUserId, onChatMemberSelect, onScreenSelect]);

  useEffect(() => {
    setPermissions((chat?.defaultBannedRights) || {});
    setHavePermissionChanged(false);
    setTimeout(() => {
      setIsLoading(false);
    }, FLOATING_BUTTON_ANIMATION_TIMEOUT_MS);
  }, [chat]);

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
    if (!chat) {
      return;
    }

    setIsLoading(true);
    updateChatDefaultBannedRights({ chatId: chat.id, bannedRights: permissions });
  }, [chat, permissions, updateChatDefaultBannedRights]);

  const removedUsersCount = useMemo(() => {
    if (!chat || !chat.fullInfo || !chat.fullInfo.kickedMembers) {
      return 0;
    }

    return chat.fullInfo.kickedMembers.length;
  }, [chat]);

  const exceptionMembers = useMemo(() => {
    if (!chat || !chat.fullInfo || !chat.fullInfo.members) {
      return [];
    }

    return chat.fullInfo.members.filter(({ bannedRights }) => Boolean(bannedRights));
  }, [chat]);

  const getMemberExceptions = useCallback((member: ApiChatMember) => {
    const { bannedRights } = member;
    if (!bannedRights || !chat) {
      return undefined;
    }

    const { defaultBannedRights } = chat;

    return Object.keys(bannedRights).reduce((result, key) => {
      if (
        !bannedRights[key as keyof ApiChatBannedRights]
        || (defaultBannedRights?.[key as keyof ApiChatBannedRights])
        || key === 'sendInline' || key === 'viewMessages' || key === 'sendGames'
      ) {
        return result;
      }

      const langKey = getLangKeyForBannedRightKey(key);

      if (!langKey) {
        return result;
      }

      const translatedString = lang(langKey);

      return `${result}${!result.length ? translatedString : `, ${translatedString}`}`;
    }, '');
  }, [chat, lang]);

  return (
    <div className="Management">
      <div className="custom-scroll">
        <div className="section">
          <h3 className="section-heading" dir="auto">{lang('ChannelPermissionsHeader')}</h3>

          <div className="ListItem no-selection">
            <Checkbox
              name="sendMessages"
              checked={!permissions.sendMessages}
              label={lang('UserRestrictionsSend')}
              blocking
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem no-selection">
            <Checkbox
              name="sendMedia"
              checked={!permissions.sendMedia}
              label={lang('UserRestrictionsSendMedia')}
              blocking
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem no-selection">
            <Checkbox
              name="sendStickers"
              checked={!permissions.sendStickers && !permissions.sendGifs}
              label={lang('UserRestrictionsSendStickers')}
              blocking
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem no-selection">
            <Checkbox
              name="sendPolls"
              checked={!permissions.sendPolls}
              label={lang('UserRestrictionsSendPolls')}
              blocking
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem no-selection">
            <Checkbox
              name="embedLinks"
              checked={!permissions.embedLinks}
              label={lang('UserRestrictionsEmbedLinks')}
              blocking
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem no-selection">
            <Checkbox
              name="inviteUsers"
              checked={!permissions.inviteUsers}
              label={lang('UserRestrictionsInviteUsers')}
              blocking
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem no-selection">
            <Checkbox
              name="pinMessages"
              checked={!permissions.pinMessages}
              label={lang('UserRestrictionsPinMessages')}
              blocking
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem no-selection">
            <Checkbox
              name="changeInfo"
              checked={!permissions.changeInfo}
              label={lang('UserRestrictionsChangeInfo')}
              blocking
              onChange={handlePermissionChange}
            />
          </div>
          {isForum && (
            <div className="ListItem no-selection">
              <Checkbox
                name="manageTopics"
                checked={!permissions.manageTopics}
                label={lang('CreateTopicsPermission')}
                blocking
                onChange={handlePermissionChange}
              />
            </div>
          )}
        </div>

        <div className="section">
          <ListItem
            icon="delete-user"
            multiline
            narrow
            onClick={handleRemovedUsersClick}
          >
            <span className="title">{lang('ChannelBlockedUsers')}</span>
            <span className="subtitle">{removedUsersCount}</span>
          </ListItem>
        </div>

        <div className="section">
          <h3 className="section-heading" dir="auto">{lang('PrivacyExceptions')}</h3>

          <ListItem
            icon="add-user"
            onClick={handleAddExceptionClick}
          >
            {lang('ChannelAddException')}
          </ListItem>

          {exceptionMembers.map((member) => (
            <ListItem
              key={member.userId}
              className="chat-item-clickable exceptions-member"
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => handleExceptionMemberClick(member)}
            >
              <PrivateChatInfo
                userId={member.userId}
                status={getMemberExceptions(member)}
              />
            </ListItem>
          ))}
        </div>
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
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);

    return { chat, currentUserId: global.currentUserId };
  },
)(ManageGroupPermissions));
