import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiChatBannedRights, ApiChatMember } from '../../../api/types';
import { ManagementScreens } from '../../../types';

import { selectChat, selectChatFullInfo } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useOldLang from '../../../hooks/useOldLang';
import useManagePermissions from '../hooks/useManagePermissions';

import Icon from '../../common/icons/Icon';
import PrivateChatInfo from '../../common/PrivateChatInfo';
import PermissionCheckboxList from '../../main/PermissionCheckboxList';
import ConfirmDialog from '../../ui/ConfirmDialog';
import FloatingActionButton from '../../ui/FloatingActionButton';
import ListItem from '../../ui/ListItem';
import Spinner from '../../ui/Spinner';

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
  hasFullInfo?: boolean;
  members?: ApiChatMember[];
  isFormFullyDisabled?: boolean;
};

const ITEM_HEIGHT = 48;
const SHIFT_HEIGHT_MINUS = 1;
const BEFORE_ITEMS_COUNT = 2;
const BEFORE_USER_INFO_HEIGHT = 96;
const ITEMS_COUNT = 9;

const ManageGroupUserPermissions: FC<OwnProps & StateProps> = ({
  chat,
  selectedChatMemberId,
  hasFullInfo,
  members,
  onScreenSelect,
  isFormFullyDisabled,
  onClose,
  isActive,
}) => {
  const { updateChatMemberBannedRights } = getActions();

  const selectedChatMember = useMemo(() => {
    if (!members) {
      return undefined;
    }

    return members.find(({ userId }) => userId === selectedChatMemberId);
  }, [members, selectedChatMemberId]);

  const {
    permissions, havePermissionChanged, isLoading, handlePermissionChange, setIsLoading,
  } = useManagePermissions(selectedChatMember?.bannedRights || chat?.defaultBannedRights);
  const [isBanConfirmationDialogOpen, openBanConfirmationDialog, closeBanConfirmationDialog] = useFlag();
  const lang = useLang();
  const oldLang = useOldLang();

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  useEffect(() => {
    if (hasFullInfo && selectedChatMemberId && !selectedChatMember) {
      onScreenSelect(ManagementScreens.GroupPermissions);
    }
  }, [chat, hasFullInfo, onScreenSelect, selectedChatMember, selectedChatMemberId]);

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
  }, [chat, selectedChatMemberId, setIsLoading, updateChatMemberBannedRights, permissions]);

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

  const [isMediaDropdownOpen, setIsMediaDropdownOpen] = useState(false);

  if (!selectedChatMember) {
    return undefined;
  }

  return (
    <div
      className="Management with-shifted-dropdown"
      style={`--shift-height: ${ITEMS_COUNT * ITEM_HEIGHT - SHIFT_HEIGHT_MINUS}px;`
           + `--before-shift-height: ${BEFORE_ITEMS_COUNT * ITEM_HEIGHT + BEFORE_USER_INFO_HEIGHT}px;`}
    >
      <div className="custom-scroll">
        <div className="section without-bottom-shadow">
          <ListItem inactive className="chat-item-clickable">
            <PrivateChatInfo userId={selectedChatMember.userId} forceShowSelf />
          </ListItem>

          <h3 className="section-heading mt-4" dir="auto">{oldLang('UserRestrictionsCanDo')}</h3>
          <PermissionCheckboxList
            chatId={chat?.id}
            isMediaDropdownOpen={isMediaDropdownOpen}
            setIsMediaDropdownOpen={setIsMediaDropdownOpen}
            handlePermissionChange={handlePermissionChange}
            permissions={permissions}
            className={buildClassName(
              'DropdownList',
              isMediaDropdownOpen && 'DropdownList--open',
            )}
            dropdownClassName="DropdownListTrap"
            shiftedClassName={buildClassName('part', isMediaDropdownOpen && 'shifted')}
            getControlIsDisabled={getControlIsDisabled}
          />
        </div>

        {!isFormFullyDisabled && (
          <div
            className={buildClassName(
              'section',
              isMediaDropdownOpen && 'shifted',
            )}
          >
            <ListItem icon="delete-user" ripple destructive onClick={openBanConfirmationDialog}>
              {oldLang('UserRestrictionsBlock')}
            </ListItem>
          </div>
        )}
      </div>

      <FloatingActionButton
        isShown={havePermissionChanged}
        onClick={handleSavePermissions}
        ariaLabel={oldLang('Save')}
        disabled={isLoading}
      >
        {isLoading ? (
          <Spinner color="white" />
        ) : (
          <Icon name="check" />
        )}
      </FloatingActionButton>

      <ConfirmDialog
        isOpen={isBanConfirmationDialogOpen}
        onClose={closeBanConfirmationDialog}
        text={lang('GroupManagementBanUserConfirm')}
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
    const fullInfo = selectChatFullInfo(global, chatId);
    const isFormFullyDisabled = !(chat.isCreator || isPromotedByCurrentUser);

    return {
      chat,
      isFormFullyDisabled,
      hasFullInfo: Boolean(fullInfo),
      members: fullInfo?.members,
    };
  },
  (global, { chatId }) => {
    return Boolean(selectChat(global, chatId));
  },
)(ManageGroupUserPermissions));
