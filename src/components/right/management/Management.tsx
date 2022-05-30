import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ManagementType } from '../../../types';
import { ManagementScreens } from '../../../types';

import { selectCurrentManagementType } from '../../../global/selectors';

import ManageUser from './ManageUser';
import ManageGroup from './ManageGroup';
import ManageGroupPermissions from './ManageGroupPermissions';
import ManageChatRemovedUsers from './ManageChatRemovedUsers';
import ManageChannel from './ManageChannel';
import ManageChatPrivacyType from './ManageChatPrivacyType';
import ManageDiscussion from './ManageDiscussion';
import ManageGroupUserPermissions from './ManageGroupUserPermissions';
import ManageChatAdministrators from './ManageChatAdministrators';
import ManageGroupRecentActions from './ManageGroupRecentActions';
import ManageGroupAdminRights from './ManageGroupAdminRights';
import ManageGroupMembers from './ManageGroupMembers';
import ManageGroupUserPermissionsCreate from './ManageGroupUserPermissionsCreate';
import ManageInvites from './ManageInvites';
import ManageInvite from './ManageInvite';
import ManageReactions from './ManageReactions';
import ManageInviteInfo from './ManageInviteInfo';
import ManageJoinRequests from './ManageJoinRequests';

export type OwnProps = {
  chatId: string;
  currentScreen: ManagementScreens;
  selectedChatMemberId?: string;
  isPromotedByCurrentUser?: boolean;
  onScreenSelect: (screen: ManagementScreens) => void;
  onChatMemberSelect: (memberId: string, isPromotedByCurrentUser?: boolean) => void;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  managementType?: ManagementType;
};

const Management: FC<OwnProps & StateProps> = ({
  chatId,
  currentScreen,
  selectedChatMemberId,
  isPromotedByCurrentUser,
  onScreenSelect,
  onChatMemberSelect,
  onClose,
  isActive,
  managementType,
}) => {
  switch (currentScreen) {
    case ManagementScreens.Initial: {
      switch (managementType) {
        case 'user':
          return (
            <ManageUser
              key={chatId}
              userId={chatId}
              onClose={onClose}
              isActive={isActive}
            />
          );
        case 'group':
          return (
            <ManageGroup
              key={chatId}
              chatId={chatId}
              onScreenSelect={onScreenSelect}
              onClose={onClose}
              isActive={isActive || [
                ManagementScreens.ChatPrivacyType,
                ManagementScreens.Discussion,
                ManagementScreens.GroupPermissions,
                ManagementScreens.ChatAdministrators,
                ManagementScreens.GroupRemovedUsers,
                ManagementScreens.GroupUserPermissionsCreate,
                ManagementScreens.GroupUserPermissions,
                ManagementScreens.ChatAdminRights,
                ManagementScreens.ChatNewAdminRights,
                ManagementScreens.GroupRecentActions,
              ].includes(currentScreen)}
            />
          );
        case 'channel':
          return (
            <ManageChannel
              key={chatId}
              chatId={chatId}
              onScreenSelect={onScreenSelect}
              onClose={onClose}
              isActive={isActive || [
                ManagementScreens.ChannelSubscribers,
                ManagementScreens.ChatAdministrators,
                ManagementScreens.ChannelRemovedUsers,
                ManagementScreens.Discussion,
                ManagementScreens.ChatPrivacyType,
                ManagementScreens.ChatAdminRights,
                ManagementScreens.ChatNewAdminRights,
                ManagementScreens.GroupRecentActions,
              ].includes(currentScreen)}
            />
          );
      }

      break;
    }

    case ManagementScreens.ChatPrivacyType:
      return (
        <ManageChatPrivacyType
          chatId={chatId}
          isActive={isActive}
          onClose={onClose}
        />
      );

    case ManagementScreens.Discussion:
      return (
        <ManageDiscussion
          chatId={chatId}
          onScreenSelect={onScreenSelect}
          isActive={isActive}
          onClose={onClose}
        />
      );

    case ManagementScreens.GroupPermissions:
      return (
        <ManageGroupPermissions
          chatId={chatId}
          onScreenSelect={onScreenSelect}
          onChatMemberSelect={onChatMemberSelect}
          isActive={isActive || [
            ManagementScreens.GroupRemovedUsers,
            ManagementScreens.GroupUserPermissionsCreate,
            ManagementScreens.GroupUserPermissions,
          ].includes(currentScreen)}
          onClose={onClose}
        />
      );

    case ManagementScreens.ChannelRemovedUsers:
    case ManagementScreens.GroupRemovedUsers:
      return (
        <ManageChatRemovedUsers
          chatId={chatId}
          isActive={isActive}
          onClose={onClose}
        />
      );

    case ManagementScreens.GroupUserPermissionsCreate:
      return (
        <ManageGroupUserPermissionsCreate
          chatId={chatId}
          onChatMemberSelect={onChatMemberSelect}
          onScreenSelect={onScreenSelect}
          isActive={isActive || [
            ManagementScreens.GroupUserPermissions,
          ].includes(currentScreen)}
          onClose={onClose}
        />
      );

    case ManagementScreens.GroupUserPermissions:
      return (
        <ManageGroupUserPermissions
          chatId={chatId}
          selectedChatMemberId={selectedChatMemberId}
          isPromotedByCurrentUser={isPromotedByCurrentUser}
          onScreenSelect={onScreenSelect}
          isActive={isActive}
          onClose={onClose}
        />
      );

    case ManagementScreens.ChatAdministrators:
      return (
        <ManageChatAdministrators
          chatId={chatId}
          onScreenSelect={onScreenSelect}
          onChatMemberSelect={onChatMemberSelect}
          isActive={isActive || [
            ManagementScreens.ChatAdminRights,
            ManagementScreens.ChatNewAdminRights,
            ManagementScreens.GroupRecentActions,
          ].includes(currentScreen)}
          onClose={onClose}
        />
      );

    case ManagementScreens.GroupRecentActions:
      return (
        <ManageGroupRecentActions
          chatId={chatId}
          isActive={isActive}
          onClose={onClose}
        />
      );

    case ManagementScreens.ChatNewAdminRights:
    case ManagementScreens.ChatAdminRights:
      return (
        <ManageGroupAdminRights
          chatId={chatId}
          isNewAdmin={currentScreen === ManagementScreens.ChatNewAdminRights}
          selectedUserId={selectedChatMemberId}
          isPromotedByCurrentUser={isPromotedByCurrentUser}
          onScreenSelect={onScreenSelect}
          isActive={isActive}
          onClose={onClose}
        />
      );

    case ManagementScreens.ChannelSubscribers:
    case ManagementScreens.GroupMembers:
      return (
        <ManageGroupMembers
          chatId={chatId}
          isActive={isActive}
          onClose={onClose}
        />
      );
    case ManagementScreens.Invites:
      return (
        <ManageInvites
          chatId={chatId}
          isActive={isActive}
          onClose={onClose}
          onScreenSelect={onScreenSelect}
        />
      );
    case ManagementScreens.EditInvite:
      return (
        <ManageInvite
          chatId={chatId}
          isActive={isActive}
          onClose={onClose}
          onScreenSelect={onScreenSelect}
        />
      );
    case ManagementScreens.GroupAddAdmins:
      return (
        <ManageGroupMembers
          chatId={chatId}
          noAdmins
          isActive={isActive}
          onClose={onClose}
          onScreenSelect={onScreenSelect}
          onChatMemberSelect={onChatMemberSelect}
        />
      );

    case ManagementScreens.Reactions:
      return (
        <ManageReactions
          chatId={chatId}
          isActive={isActive}
          onClose={onClose}
        />
      );
    case ManagementScreens.InviteInfo:
      return (
        <ManageInviteInfo
          chatId={chatId}
          isActive={isActive}
          onClose={onClose}
        />
      );
    case ManagementScreens.JoinRequests:
      return (
        <ManageJoinRequests
          chatId={chatId}
          isActive={isActive}
          onClose={onClose}
        />
      );
  }

  return undefined; // Never reached
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const managementType = selectCurrentManagementType(global);

    return {
      managementType,
    };
  },
)(Management));
