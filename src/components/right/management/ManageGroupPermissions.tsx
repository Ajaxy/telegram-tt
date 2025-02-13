import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiChatBannedRights, ApiChatMember } from '../../../api/types';
import { ManagementScreens } from '../../../types';

import { selectChat, selectChatFullInfo } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useOldLang from '../../../hooks/useOldLang';
import useManagePermissions from '../hooks/useManagePermissions';

import Icon from '../../common/icons/Icon';
import PrivateChatInfo from '../../common/PrivateChatInfo';
import PermissionCheckboxList from '../../main/PermissionCheckboxList';
import FloatingActionButton from '../../ui/FloatingActionButton';
import ListItem from '../../ui/ListItem';
import Spinner from '../../ui/Spinner';

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
  removedUsersCount: number;
  members?: ApiChatMember[];
};

const ITEM_HEIGHT = 48;
const BEFORE_ITEMS_COUNT = 2;
const ITEMS_COUNT = 9;

function getLangKeyForBannedRightKey(key: keyof ApiChatBannedRights) {
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
    case 'sendPlain':
      return 'UserRestrictionsNoSendText';
    case 'sendDocs':
      return 'UserRestrictionsNoSendDocs';
    case 'sendRoundvideos':
      return 'UserRestrictionsNoSendRound';
    case 'sendVoices':
      return 'UserRestrictionsNoSendVoice';
    case 'sendAudios':
      return 'UserRestrictionsNoSendMusic';
    case 'sendVideos':
      return 'UserRestrictionsNoSendVideos';
    case 'sendPhotos':
      return 'UserRestrictionsNoSendPhotos';
    default:
      return undefined;
  }
}

const ManageGroupPermissions: FC<OwnProps & StateProps> = ({
  onScreenSelect,
  onChatMemberSelect,
  chat,
  currentUserId,
  removedUsersCount,
  members,
  onClose,
  isActive,
}) => {
  const { updateChatDefaultBannedRights } = getActions();

  const {
    permissions, havePermissionChanged, isLoading, handlePermissionChange, setIsLoading,
  } = useManagePermissions(chat?.defaultBannedRights);
  const lang = useOldLang();

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

  const [isMediaDropdownOpen, setIsMediaDropdownOpen] = useState(false);

  const handleSavePermissions = useCallback(() => {
    if (!chat) {
      return;
    }

    setIsLoading(true);
    updateChatDefaultBannedRights({ chatId: chat.id, bannedRights: permissions });
  }, [chat, permissions, setIsLoading, updateChatDefaultBannedRights]);

  const exceptionMembers = useMemo(() => {
    if (!members) {
      return [];
    }

    return members.filter(({ bannedRights }) => Boolean(bannedRights));
  }, [members]);

  const getMemberExceptions = useCallback((member: ApiChatMember) => {
    const { bannedRights } = member;
    if (!bannedRights || !chat) {
      return undefined;
    }

    const { defaultBannedRights } = chat;

    return Object.keys(bannedRights).reduce((result, k) => {
      const key = k as keyof ApiChatBannedRights;
      if (
        !bannedRights[key]
        || (defaultBannedRights?.[key])
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
    <div
      className="Management with-shifted-dropdown"
      style={`--shift-height: ${ITEMS_COUNT * ITEM_HEIGHT}px;`
        + `--before-shift-height: ${BEFORE_ITEMS_COUNT * ITEM_HEIGHT}px;`}
    >
      <div className="custom-scroll">
        <div className="section without-bottom-shadow">
          <h3 className="section-heading" dir="auto">{lang('ChannelPermissionsHeader')}</h3>
          <PermissionCheckboxList
            chatId={chat?.id}
            isMediaDropdownOpen={isMediaDropdownOpen}
            setIsMediaDropdownOpen={setIsMediaDropdownOpen}
            handlePermissionChange={handlePermissionChange}
            permissions={permissions}
            dropdownClassName="DropdownListTrap"
            className={buildClassName(
              'DropdownList',
              isMediaDropdownOpen && 'DropdownList--open',
            )}
            shiftedClassName={buildClassName('part', isMediaDropdownOpen && 'shifted')}
          />
        </div>

        <div
          className={buildClassName(
            'section',
            isMediaDropdownOpen && 'shifted',
          )}
        >
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

        <div
          className={buildClassName(
            'section',
            isMediaDropdownOpen && 'shifted',
          )}
        >
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
                forceShowSelf
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
          <Icon name="check" />
        )}
      </FloatingActionButton>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    const fullInfo = selectChatFullInfo(global, chatId);

    return {
      chat,
      currentUserId: global.currentUserId,
      removedUsersCount: fullInfo?.kickedMembers?.length || 0,
      members: fullInfo?.members,
    };
  },
)(ManageGroupPermissions));
