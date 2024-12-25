import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useMemo,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChat, ApiChatBannedRights } from '../../api/types';

import { isChatPublic } from '../../global/helpers';
import { selectChat, selectChatFullInfo } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import stopEvent from '../../util/stopEvent';

import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Checkbox from '../ui/Checkbox';

export type OwnProps = {
  chatId?: string;
  handlePermissionChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  permissions: ApiChatBannedRights;
  isMediaDropdownOpen: boolean;
  setIsMediaDropdownOpen: (open: boolean) => void;
  className?: string;
  shiftedClassName?: string;
  dropdownClassName?: string;
  withCheckbox?: boolean;
  permissionGroup?: boolean;
  getControlIsDisabled?: (key: Exclude<keyof ApiChatBannedRights, 'untilDate'>) => boolean | undefined;
};

type StateProps = {
  chat?: ApiChat;
  hasLinkedChat?: boolean;
};

const permissionKeyList: (keyof ApiChatBannedRights)[] = [
  'sendPhotos', 'sendVideos', 'sendStickers',
  'sendAudios', 'sendDocs', 'sendVoices', 'sendRoundvideos', 'embedLinks', 'sendPolls',
];

const PermissionCheckboxList: FC<OwnProps & StateProps> = ({
  chat,
  isMediaDropdownOpen,
  setIsMediaDropdownOpen,
  hasLinkedChat,
  permissions,
  handlePermissionChange,
  className,
  shiftedClassName,
  dropdownClassName,
  withCheckbox,
  getControlIsDisabled,
  permissionGroup,
}) => {
  const {
    showNotification,
  } = getActions();

  const { isForum } = chat || {};

  const lang = useOldLang();

  const isPublic = useMemo(() => chat && isChatPublic(chat), [chat]);
  const shouldDisablePermissionForPublicGroup = hasLinkedChat || isPublic;

  const countCheckedPermissions = useMemo(() => {
    return permissionKeyList.reduce((count, key) => {
      if (!permissions[key]) {
        count += 1;
      }
      return count;
    }, 0);
  }, [permissions]);

  const handleOpenMediaDropdown = useLastCallback((e: React.MouseEvent) => {
    stopEvent(e);
    setIsMediaDropdownOpen(!isMediaDropdownOpen);
  });

  const handleDisabledClick = useLastCallback(() => {
    showNotification({ message: lang('lng_rights_permission_unavailable') });
  });

  return (
    <>
      <div className={buildClassName('ListItem', withCheckbox && 'with-checkbox')}>
        <Checkbox
          name="sendPlain"
          checked={!permissions.sendPlain}
          label={lang('UserRestrictionsSend')}
          blocking
          permissionGroup={permissionGroup}
          onChange={handlePermissionChange}
          disabled={getControlIsDisabled && getControlIsDisabled('sendPlain')}
        />
      </div>
      <div className={buildClassName('ListItem', withCheckbox && 'with-checkbox')}>
        <Checkbox
          name="sendMedia"
          checked={!permissions.sendMedia}
          label={lang('UserRestrictionsSendMedia')}
          labelText={`${countCheckedPermissions}/${permissionKeyList.length}`}
          blocking
          permissionGroup={permissionGroup}
          rightIcon={isMediaDropdownOpen ? 'up' : 'down'}
          onChange={handlePermissionChange}
          onClickLabel={handleOpenMediaDropdown}
          disabled={getControlIsDisabled && getControlIsDisabled('sendMedia')}
        />
      </div>
      <div className={dropdownClassName}>
        <div
          className={className}
        >
          <div className={buildClassName('ListItem', withCheckbox && 'with-checkbox')}>
            <Checkbox
              name="sendPhotos"
              checked={!permissions.sendPhotos}
              label={lang('UserRestrictionsSendPhotos')}
              blocking
              permissionGroup={permissionGroup}
              onChange={handlePermissionChange}
              disabled={getControlIsDisabled && getControlIsDisabled('sendPhotos')}
            />
          </div>

          <div className={buildClassName('ListItem', withCheckbox && 'with-checkbox')}>
            <Checkbox
              name="sendVideos"
              checked={!permissions.sendVideos}
              label={lang('UserRestrictionsSendVideos')}
              blocking
              permissionGroup={permissionGroup}
              onChange={handlePermissionChange}
              disabled={getControlIsDisabled && getControlIsDisabled('sendVideos')}
            />
          </div>

          <div className={buildClassName('ListItem', withCheckbox && 'with-checkbox')}>
            <Checkbox
              name="sendStickers"
              checked={!permissions.sendStickers && !permissions.sendGifs}
              label={lang('UserRestrictionsSendStickers')}
              blocking
              permissionGroup={permissionGroup}
              onChange={handlePermissionChange}
              disabled={getControlIsDisabled && getControlIsDisabled('sendStickers')}
            />
          </div>

          <div className={buildClassName('ListItem', withCheckbox && 'with-checkbox')}>
            <Checkbox
              name="sendAudios"
              checked={!permissions.sendAudios}
              label={lang('UserRestrictionsSendMusic')}
              blocking
              permissionGroup={permissionGroup}
              onChange={handlePermissionChange}
              disabled={getControlIsDisabled && getControlIsDisabled('sendAudios')}
            />
          </div>

          <div className={buildClassName('ListItem', withCheckbox && 'with-checkbox')}>
            <Checkbox
              name="sendDocs"
              checked={!permissions.sendDocs}
              label={lang('UserRestrictionsSendFiles')}
              blocking
              permissionGroup={permissionGroup}
              onChange={handlePermissionChange}
              disabled={getControlIsDisabled && getControlIsDisabled('sendDocs')}
            />
          </div>

          <div className={buildClassName('ListItem', withCheckbox && 'with-checkbox')}>
            <Checkbox
              name="sendVoices"
              checked={!permissions.sendVoices}
              label={lang('UserRestrictionsSendVoices')}
              blocking
              permissionGroup={permissionGroup}
              onChange={handlePermissionChange}
              disabled={getControlIsDisabled && getControlIsDisabled('sendVoices')}
            />
          </div>

          <div className={buildClassName('ListItem', withCheckbox && 'with-checkbox')}>
            <Checkbox
              name="sendRoundvideos"
              checked={!permissions.sendRoundvideos}
              label={lang('UserRestrictionsSendRound')}
              blocking
              permissionGroup={permissionGroup}
              onChange={handlePermissionChange}
              disabled={getControlIsDisabled && getControlIsDisabled('sendRoundvideos')}
            />
          </div>

          <div className={buildClassName('ListItem', withCheckbox && 'with-checkbox')}>
            <Checkbox
              name="embedLinks"
              checked={!permissions.embedLinks}
              label={lang('UserRestrictionsEmbedLinks')}
              blocking
              permissionGroup={permissionGroup}
              onChange={handlePermissionChange}
              disabled={getControlIsDisabled && getControlIsDisabled('embedLinks')}
            />
          </div>

          <div className={buildClassName('ListItem', withCheckbox && 'with-checkbox')}>
            <Checkbox
              name="sendPolls"
              checked={!permissions.sendPolls}
              label={lang('UserRestrictionsSendPolls')}
              blocking
              permissionGroup={permissionGroup}
              onChange={handlePermissionChange}
              disabled={getControlIsDisabled && getControlIsDisabled('sendPolls')}
            />
          </div>
        </div>
      </div>
      <div className={shiftedClassName}>
        <div className={buildClassName('ListItem', withCheckbox && 'with-checkbox')}>
          <Checkbox
            name="inviteUsers"
            checked={!permissions.inviteUsers}
            label={lang('UserRestrictionsInviteUsers')}
            blocking
            permissionGroup={permissionGroup}
            onChange={handlePermissionChange}
            disabled={getControlIsDisabled && getControlIsDisabled('inviteUsers')}
          />
        </div>
        <div
          className={buildClassName('ListItem', withCheckbox && 'with-checkbox')}
          onClick={shouldDisablePermissionForPublicGroup ? handleDisabledClick : undefined}
        >
          <Checkbox
            name="pinMessages"
            checked={!permissions.pinMessages}
            label={lang('UserRestrictionsPinMessages')}
            disabled={getControlIsDisabled ? getControlIsDisabled('pinMessages')
              : shouldDisablePermissionForPublicGroup}
            blocking
            permissionGroup={permissionGroup}
            onChange={handlePermissionChange}
          />
        </div>
        <div
          className={buildClassName('ListItem', withCheckbox && 'with-checkbox')}
          onClick={shouldDisablePermissionForPublicGroup ? handleDisabledClick : undefined}
        >
          <Checkbox
            name="changeInfo"
            checked={!permissions.changeInfo}
            label={lang('UserRestrictionsChangeInfo')}
            blocking
            permissionGroup={permissionGroup}
            disabled={getControlIsDisabled ? getControlIsDisabled('changeInfo')
              : shouldDisablePermissionForPublicGroup}
            onChange={handlePermissionChange}
          />
        </div>
        {isForum && (
          <div className={buildClassName('ListItem', withCheckbox && 'with-checkbox')}>
            <Checkbox
              name="manageTopics"
              checked={!permissions.manageTopics}
              label={lang('CreateTopicsPermission')}
              blocking
              permissionGroup={permissionGroup}
              onChange={handlePermissionChange}
              disabled={getControlIsDisabled && getControlIsDisabled('manageTopics')}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = chatId ? selectChat(global, chatId) : undefined;
    const fullInfo = chat && selectChatFullInfo(global, chat.id);
    const hasLinkedChat = Boolean(fullInfo?.linkedChatId);

    return {
      chat,
      hasLinkedChat,
    };
  },
)(PermissionCheckboxList));
