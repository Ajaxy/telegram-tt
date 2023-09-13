import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiChatBannedRights, ApiChatMember } from '../../../api/types';
import { ManagementScreens } from '../../../types';

import { isChatPublic } from '../../../global/helpers';
import { selectChat, selectChatFullInfo } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import stopEvent from '../../../util/stopEvent';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useManagePermissions from '../hooks/useManagePermissions';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import Checkbox from '../../ui/Checkbox';
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
  hasLinkedChat?: boolean;
  removedUsersCount: number;
  members?: ApiChatMember[];
};

const ITEM_HEIGHT = 24 + 32;
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
  hasLinkedChat,
  removedUsersCount,
  members,
  onClose,
  isActive,
}) => {
  const { updateChatDefaultBannedRights, showNotification } = getActions();

  const {
    permissions, havePermissionChanged, isLoading, handlePermissionChange, setIsLoading,
  } = useManagePermissions(chat?.defaultBannedRights);
  const lang = useLang();
  const { isForum } = chat || {};
  const isPublic = useMemo(() => chat && isChatPublic(chat), [chat]);
  const shouldDisablePermissionForPublicGroup = hasLinkedChat || isPublic;

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
  const handleOpenMediaDropdown = useCallback((e: React.MouseEvent) => {
    stopEvent(e);
    setIsMediaDropdownOpen(!isMediaDropdownOpen);
  }, [isMediaDropdownOpen]);

  const handleDisabledClick = useCallback(() => {
    showNotification({ message: lang('lng_rights_permission_unavailable') });
  }, [lang, showNotification]);

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

          <div className="ListItem with-checkbox">
            <Checkbox
              name="sendPlain"
              checked={!permissions.sendPlain}
              label={lang('UserRestrictionsSend')}
              blocking
              onChange={handlePermissionChange}
            />
          </div>
          <div className="ListItem with-checkbox">
            <Checkbox
              name="sendMedia"
              checked={!permissions.sendMedia}
              label={lang('UserRestrictionsSendMedia')}
              blocking
              rightIcon={isMediaDropdownOpen ? 'up' : 'down'}
              onChange={handlePermissionChange}
              onClickLabel={handleOpenMediaDropdown}
            />
          </div>
          <div className="DropdownListTrap">
            <div
              className={buildClassName(
                'DropdownList',
                isMediaDropdownOpen && 'DropdownList--open',
              )}
            >
              <div className="ListItem with-checkbox">
                <Checkbox
                  name="sendPhotos"
                  checked={!permissions.sendPhotos}
                  label={lang('UserRestrictionsSendPhotos')}
                  blocking
                  onChange={handlePermissionChange}
                />
              </div>

              <div className="ListItem with-checkbox">
                <Checkbox
                  name="sendVideos"
                  checked={!permissions.sendVideos}
                  label={lang('UserRestrictionsSendVideos')}
                  blocking
                  onChange={handlePermissionChange}
                />
              </div>

              <div className="ListItem with-checkbox">
                <Checkbox
                  name="sendStickers"
                  checked={!permissions.sendStickers && !permissions.sendGifs}
                  label={lang('UserRestrictionsSendStickers')}
                  blocking
                  onChange={handlePermissionChange}
                />
              </div>

              <div className="ListItem with-checkbox">
                <Checkbox
                  name="sendAudios"
                  checked={!permissions.sendAudios}
                  label={lang('UserRestrictionsSendMusic')}
                  blocking
                  onChange={handlePermissionChange}
                />
              </div>

              <div className="ListItem with-checkbox">
                <Checkbox
                  name="sendDocs"
                  checked={!permissions.sendDocs}
                  label={lang('UserRestrictionsSendFiles')}
                  blocking
                  onChange={handlePermissionChange}
                />
              </div>

              <div className="ListItem with-checkbox">
                <Checkbox
                  name="sendVoices"
                  checked={!permissions.sendVoices}
                  label={lang('UserRestrictionsSendVoices')}
                  blocking
                  onChange={handlePermissionChange}
                />
              </div>

              <div className="ListItem with-checkbox">
                <Checkbox
                  name="sendRoundvideos"
                  checked={!permissions.sendRoundvideos}
                  label={lang('UserRestrictionsSendRound')}
                  blocking
                  onChange={handlePermissionChange}
                />
              </div>

              <div className="ListItem with-checkbox">
                <Checkbox
                  name="embedLinks"
                  checked={!permissions.embedLinks}
                  label={lang('UserRestrictionsEmbedLinks')}
                  blocking
                  onChange={handlePermissionChange}
                />
              </div>

              <div className="ListItem with-checkbox">
                <Checkbox
                  name="sendPolls"
                  checked={!permissions.sendPolls}
                  label={lang('UserRestrictionsSendPolls')}
                  blocking
                  onChange={handlePermissionChange}
                />
              </div>
            </div>
          </div>

          <div className={buildClassName('part', isMediaDropdownOpen && 'shifted')}>
            <div className="ListItem with-checkbox">
              <Checkbox
                name="inviteUsers"
                checked={!permissions.inviteUsers}
                label={lang('UserRestrictionsInviteUsers')}
                blocking
                onChange={handlePermissionChange}
              />
            </div>
            <div
              className="ListItem with-checkbox"
              onClick={shouldDisablePermissionForPublicGroup ? handleDisabledClick : undefined}
            >
              <Checkbox
                name="pinMessages"
                checked={!permissions.pinMessages}
                label={lang('UserRestrictionsPinMessages')}
                disabled={shouldDisablePermissionForPublicGroup}
                blocking
                onChange={handlePermissionChange}
              />
            </div>
            <div
              className="ListItem with-checkbox"
              onClick={shouldDisablePermissionForPublicGroup ? handleDisabledClick : undefined}
            >
              <Checkbox
                name="changeInfo"
                checked={!permissions.changeInfo}
                label={lang('UserRestrictionsChangeInfo')}
                blocking
                disabled={shouldDisablePermissionForPublicGroup}
                onChange={handlePermissionChange}
              />
            </div>
            {isForum && (
              <div className="ListItem with-checkbox">
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
          <i className="icon icon-check" />
        )}
      </FloatingActionButton>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    const fullInfo = selectChatFullInfo(global, chatId);
    const hasLinkedChat = Boolean(fullInfo?.linkedChatId);

    return {
      chat,
      currentUserId: global.currentUserId,
      hasLinkedChat,
      removedUsersCount: fullInfo?.kickedMembers?.length || 0,
      members: fullInfo?.members,
    };
  },
)(ManageGroupPermissions));
