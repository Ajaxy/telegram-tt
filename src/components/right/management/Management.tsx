import React, { FC, memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { ManagementScreens, ManagementType } from '../../../types';

import { selectCurrentManagementType } from '../../../modules/selectors';

import ManageUser from './ManageUser';
import ManageGroup from './ManageGroup';
import ManageGroupPermissions from './ManageGroupPermissions';
import ManageGroupRemovedUsers from './ManageGroupRemovedUsers';
import ManageChannel from './ManageChannel';
import ManageChatPrivacyType from './ManageChatPrivacyType';
import ManageDiscussion from './ManageDiscussion';
import ManageGroupUserPermissions from './ManageGroupUserPermissions';
import ManageChatAdministrators from './ManageChatAdministrators';
import ManageGroupRecentActions from './ManageGroupRecentActions';
import ManageGroupAdminRights from './ManageGroupAdminRights';
import ManageGroupMembers from './ManageGroupMembers';
import ManageGroupUserPermissionsCreate from './ManageGroupUserPermissionsCreate';

export type OwnProps = {
  chatId: number;
  currentScreen: ManagementScreens;
  selectedChatMemberId?: number;
  isPromotedByCurrentUser?: boolean;
  onScreenSelect: (screen: ManagementScreens) => void;
  onChatMemberSelect: (memberId: number, isPromotedByCurrentUser?: boolean) => void;
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
  managementType,
}) => {
  switch (currentScreen) {
    case ManagementScreens.Initial: {
      switch (managementType) {
        case 'user':
          return <ManageUser key={chatId} userId={chatId} />;
        case 'group':
          return <ManageGroup key={chatId} chatId={chatId} onScreenSelect={onScreenSelect} />;
        case 'channel':
          return <ManageChannel key={chatId} chatId={chatId} onScreenSelect={onScreenSelect} />;
      }

      break;
    }

    case ManagementScreens.ChatPrivacyType:
      return (
        <ManageChatPrivacyType chatId={chatId} />
      );

    case ManagementScreens.Discussion:
      return (
        <ManageDiscussion
          chatId={chatId}
          onScreenSelect={onScreenSelect}
        />
      );

    case ManagementScreens.GroupPermissions:
      return (
        <ManageGroupPermissions
          chatId={chatId}
          onScreenSelect={onScreenSelect}
          onChatMemberSelect={onChatMemberSelect}
        />
      );

    case ManagementScreens.GroupRemovedUsers:
      return (
        <ManageGroupRemovedUsers chatId={chatId} />
      );

    case ManagementScreens.GroupUserPermissionsCreate:
      return (
        <ManageGroupUserPermissionsCreate
          chatId={chatId}
          onChatMemberSelect={onChatMemberSelect}
          onScreenSelect={onScreenSelect}
        />
      );

    case ManagementScreens.GroupUserPermissions:
      return (
        <ManageGroupUserPermissions
          chatId={chatId}
          selectedChatMemberId={selectedChatMemberId}
          isPromotedByCurrentUser={isPromotedByCurrentUser}
          onScreenSelect={onScreenSelect}
        />
      );

    case ManagementScreens.ChatAdministrators:
      return (
        <ManageChatAdministrators
          chatId={chatId}
          onScreenSelect={onScreenSelect}
          onChatMemberSelect={onChatMemberSelect}
        />
      );

    case ManagementScreens.GroupRecentActions:
      return (
        <ManageGroupRecentActions
          chatId={chatId}
        />
      );

    case ManagementScreens.ChatAdminRights:
      return (
        <ManageGroupAdminRights
          chatId={chatId}
          selectedChatMemberId={selectedChatMemberId}
          isPromotedByCurrentUser={isPromotedByCurrentUser}
          onScreenSelect={onScreenSelect}
        />
      );

    case ManagementScreens.ChannelSubscribers:
    case ManagementScreens.GroupMembers:
      return (
        <ManageGroupMembers chatId={chatId} />
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
