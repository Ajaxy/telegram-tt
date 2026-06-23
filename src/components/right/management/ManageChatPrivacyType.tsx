import type { ChangeEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiChat, ApiUser } from '../../../api/types';
import { ManagementProgress } from '../../../types';

import { PURCHASE_USERNAME, TME_LINK_PREFIX, USERNAME_PURCHASE_ERROR } from '../../../config';
import { getMainUsername, isChatChannel, isChatPublic } from '../../../global/helpers';
import {
  selectChat, selectChatFullInfo,
  selectManagement, selectTabState, selectUser,
} from '../../../global/selectors';
import { selectCurrentLimit } from '../../../global/selectors/limits';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';

import LinkField from '../../common/LinkField';
import ManageUsernames from '../../common/ManageUsernames';
import SafeLink from '../../common/SafeLink';
import UsernameInput from '../../common/UsernameInput';
import Island, { IslandDescription, IslandTitle } from '../../gili/layout/Island';
import SwitchField from '../../gili/templates/SwitchField';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import FloatingActionButton from '../../ui/FloatingActionButton';
import ListItem from '../../ui/ListItem';
import Loading from '../../ui/Loading';
import Modal from '../../ui/Modal';
import RadioGroup from '../../ui/RadioGroup';

type PrivacyType = 'private' | 'public';

type OwnProps = {
  chatId: string;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  chat: ApiChat;
  isChannel: boolean;
  progress?: ManagementProgress;
  isUsernameAvailable?: boolean;
  checkedUsername?: string;
  error?: string;
  isProtected?: boolean;
  isJoinRequest?: boolean;
  guardBot?: ApiUser;
  invitesCount?: number;
  areInvitesLoaded?: boolean;
  maxPublicLinks: number;
  privateInviteLink?: string;
};

const ManageChatPrivacyType: FC<OwnProps & StateProps> = ({
  chat,
  isActive,
  isChannel,
  progress,
  isUsernameAvailable,
  checkedUsername,
  error,
  isProtected,
  isJoinRequest,
  guardBot,
  invitesCount,
  areInvitesLoaded,
  maxPublicLinks,
  privateInviteLink,
  onClose,
}) => {
  const {
    updatePublicLink,
    updatePrivateLink,
    toggleIsProtected,
    toggleJoinRequest,
    loadExportedChatInvites,
    openLimitReachedModal,
    resetManagementError,
  } = getActions();

  const firstEditableUsername = useMemo(() => chat.usernames?.find(({ isEditable }) => isEditable), [chat.usernames]);
  const currentUsername = firstEditableUsername?.username || '';
  const isPublic = useMemo(() => isChatPublic(chat), [chat]);

  const [isProfileFieldsTouched, setIsProfileFieldsTouched] = useState(false);
  const [privacyType, setPrivacyType] = useState<PrivacyType>(isPublic ? 'public' : 'private');
  const [editableUsername, setEditableUsername] = useState<string>();
  const [isRevokeConfirmDialogOpen, openRevokeConfirmDialog, closeRevokeConfirmDialog] = useFlag();
  const [isUsernameLostDialogOpen, openUsernameLostDialog, closeUsernameLostDialog] = useFlag();
  const [isApplyToInvitesDialogOpen, openApplyToInvitesDialog, closeApplyToInvitesDialog] = useFlag();
  const [isJoinRequestEnabled, setIsJoinRequestEnabled] = useState(Boolean(isJoinRequest));
  const [pendingJoinRequest, setPendingJoinRequest] = useState<boolean>();

  const previousIsUsernameAvailable = usePreviousDeprecated(isUsernameAvailable);
  const renderingIsUsernameAvailable = isUsernameAvailable ?? previousIsUsernameAvailable;

  const canUpdate = isProfileFieldsTouched && Boolean(
    (privacyType === 'public'
      && (editableUsername || (currentUsername && editableUsername === ''))
      && renderingIsUsernameAvailable)
    || (privacyType === 'private' && isPublic),
  );

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  useEffect(() => {
    setIsProfileFieldsTouched(false);
  }, [currentUsername]);

  useEffect(() => {
    setIsJoinRequestEnabled(Boolean(isJoinRequest));
  }, [isJoinRequest]);

  useEffect(() => {
    if (!areInvitesLoaded) {
      loadExportedChatInvites({ chatId: chat.id });
    }
  }, [chat.id, areInvitesLoaded]);

  useEffect(() => {
    if (privacyType && !privateInviteLink) {
      updatePrivateLink();
    }
  }, [privacyType, privateInviteLink, updatePrivateLink]);

  const handleUsernameChange = useCallback((value: string) => {
    setEditableUsername(value);
    setIsProfileFieldsTouched(true);

    if (error) {
      resetManagementError({
        chatId: chat.id,
      });
    }
  }, [chat.id, error]);

  const handleOptionChange = useCallback((value: string, e: ChangeEvent<HTMLInputElement>) => {
    const myChats = Object.values(getGlobal().chats.byId)
      .filter(({ isCreator, usernames }) => isCreator && usernames?.some((c) => c.isActive));

    if (myChats.length >= maxPublicLinks && value === 'public') {
      openLimitReachedModal({ limit: 'channelsPublic' });
      const radioGroup = e.currentTarget.closest('.radio-group') as HTMLDivElement;
      // Patch for Teact bug with controlled inputs
      // TODO Teact support added, this can now be removed
      (radioGroup.querySelector('[value=public]') as HTMLInputElement).checked = false;
      (radioGroup.querySelector('[value=private]') as HTMLInputElement).checked = true;
      return;
    }
    setPrivacyType(value as PrivacyType);
    setIsProfileFieldsTouched(true);
  }, [maxPublicLinks, openLimitReachedModal]);

  const handleForwardingOptionChange = useCallback((value: string) => {
    toggleIsProtected({
      chatId: chat.id,
      isProtected: value === 'protected',
    });
  }, [chat.id, toggleIsProtected]);

  const commitJoinRequest = useLastCallback((isEnabled: boolean, shouldApplyToInvites: boolean) => {
    setIsJoinRequestEnabled(isEnabled);
    toggleJoinRequest({
      chatId: chat.id, isEnabled, shouldApplyToInvites, guardBotId: guardBot?.id,
    });
  });

  const handleApproveNewSubscribersChange = useLastCallback((isChecked: boolean) => {
    if (invitesCount && !isPublic) {
      setPendingJoinRequest(isChecked);
      openApplyToInvitesDialog();
      return;
    }

    commitJoinRequest(isChecked, false);
  });

  const handleApplyToInvites = useLastCallback(() => {
    closeApplyToInvitesDialog();
    commitJoinRequest(pendingJoinRequest!, true);
  });

  const handleDontApplyToInvites = useLastCallback(() => {
    closeApplyToInvitesDialog();
    commitJoinRequest(pendingJoinRequest!, false);
  });

  const handleSave = useCallback(() => {
    if (isPublic && privacyType === 'private') {
      openUsernameLostDialog();
    } else {
      updatePublicLink({ username: privacyType === 'public' ? (editableUsername || '') : '' });
    }
  }, [isPublic, openUsernameLostDialog, privacyType, updatePublicLink, editableUsername]);

  const handleMakeChannelPrivateConfirm = useCallback(() => {
    updatePublicLink({ username: '', shouldDisableUsernames: true });
    closeUsernameLostDialog();
  }, [closeUsernameLostDialog, updatePublicLink]);

  const handleRevokePrivateLink = useCallback(() => {
    closeRevokeConfirmDialog();
    updatePrivateLink();
  }, [closeRevokeConfirmDialog, updatePrivateLink]);

  const oldLang = useOldLang();
  const lang = useLang();
  const langPrefix1 = isChannel ? 'Channel' : 'Mega';
  const langPrefix2 = isChannel ? 'Channel' : 'Group';

  const guardBotUsername = guardBot && getMainUsername(guardBot);
  const guardBotLink = guardBotUsername
    ? <SafeLink url={`${TME_LINK_PREFIX}${guardBotUsername}`} text={`@${guardBotUsername}`} />
    : guardBot?.firstName;
  const approvalInfo = lang(getApprovalInfoKey(isChannel, Boolean(isPublic)));

  const options = [
    { value: 'private', label: oldLang(`${langPrefix1}Private`), subLabel: oldLang(`${langPrefix1}PrivateInfo`) },
    { value: 'public', label: oldLang(`${langPrefix1}Public`), subLabel: oldLang(`${langPrefix1}PublicInfo`) },
  ];

  const forwardingOptions = [{
    value: 'allowed',
    label: oldLang('ChannelVisibility.Forwarding.Enabled'),
  }, {
    value: 'protected',
    label: oldLang('ChannelVisibility.Forwarding.Disabled'),
  }];

  const isLoading = progress === ManagementProgress.InProgress;
  const shouldRenderUsernamesManage = privacyType === 'public' && chat.usernames && chat.usernames.length > 0;

  function renderPurchaseLink() {
    const purchaseInfoLink = `${TME_LINK_PREFIX}${PURCHASE_USERNAME}`;

    return (
      <IslandDescription dir="auto">
        {(oldLang('lng_username_purchase_available'))
          .replace('{link}', '%PURCHASE_LINK%')
          .split('%')
          .map((s) => {
            return (s === 'PURCHASE_LINK' ? <SafeLink url={purchaseInfoLink} text={`@${PURCHASE_USERNAME}`} /> : s);
          })}
      </IslandDescription>
    );
  }

  return (
    <div className="Management">
      <div className="panel-content custom-scroll">
        <IslandTitle dir={oldLang.isRtl ? 'rtl' : undefined}>{oldLang(`${langPrefix2}Type`)}</IslandTitle>
        <Island dir={oldLang.isRtl ? 'rtl' : undefined}>
          <RadioGroup
            selected={privacyType}
            name="channel-type"
            options={options}
            onChange={handleOptionChange}
          />
        </Island>
        {privacyType === 'private' ? (
          <>
            <IslandTitle dir={oldLang.isRtl ? 'rtl' : undefined}>
              {oldLang('InviteLink.InviteLink')}
            </IslandTitle>
            <Island dir={oldLang.isRtl ? 'rtl' : undefined}>
              {privateInviteLink ? (
                <>
                  <LinkField link={privateInviteLink} className="invite-link" noTitle />
                  <ListItem icon="delete" ripple destructive onClick={openRevokeConfirmDialog}>
                    {oldLang('RevokeLink')}
                  </ListItem>
                  <ConfirmDialog
                    isOpen={isRevokeConfirmDialogOpen}
                    onClose={closeRevokeConfirmDialog}
                    text={oldLang('RevokeAlert')}
                    confirmLabel={oldLang('RevokeButton')}
                    confirmHandler={handleRevokePrivateLink}
                    confirmIsDestructive
                  />
                </>
              ) : (
                <Loading />
              )}
            </Island>
            <IslandDescription dir={oldLang.isRtl ? 'rtl' : undefined}>
              {oldLang(`${langPrefix1}PrivateLinkHelp`)}
            </IslandDescription>
          </>
        ) : (
          <>
            <Island>
              <div className="settings-input">
                <UsernameInput
                  asLink
                  currentUsername={currentUsername}
                  isLoading={isLoading}
                  isUsernameAvailable={isUsernameAvailable}
                  checkedUsername={checkedUsername}
                  onChange={handleUsernameChange}
                />
              </div>
            </Island>
            {error === USERNAME_PURCHASE_ERROR && renderPurchaseLink()}
            <IslandDescription dir="auto">
              {oldLang(`${langPrefix2}.Username.CreatePublicLinkHelp`)}
            </IslandDescription>
          </>
        )}
        {shouldRenderUsernamesManage && (
          <ManageUsernames
            chatId={chat.id}
            usernames={chat.usernames!}
            onEditUsername={handleUsernameChange}
          />
        )}
        {!(isChannel && isPublic) && (
          <>
            <IslandTitle dir={oldLang.isRtl ? 'rtl' : undefined}>
              {oldLang('MemberRequests')}
            </IslandTitle>
            <Island dir={oldLang.isRtl ? 'rtl' : undefined}>
              <SwitchField
                checked={isJoinRequestEnabled}
                onChange={handleApproveNewSubscribersChange}
                label={lang('GuardApproveNewMembers')}
                teactExperimentControlled
              />
            </Island>
            <IslandDescription dir={oldLang.isRtl ? 'rtl' : undefined}>
              {guardBot
                ? lang('GuardManagedByDescription', {
                  approvalInfo,
                  managedBy: lang('GuardManagedBy', { bot: guardBotLink }, { withNodes: true }),
                }, { withNodes: true })
                : approvalInfo}
            </IslandDescription>
          </>
        )}
        <IslandTitle dir={oldLang.isRtl ? 'rtl' : undefined}>
          {oldLang(isChannel ? 'ChannelVisibility.Forwarding.ChannelTitle' : 'ChannelVisibility.Forwarding.GroupTitle')}
        </IslandTitle>
        <Island dir={oldLang.isRtl ? 'rtl' : undefined}>
          <RadioGroup
            selected={isProtected ? 'protected' : 'allowed'}
            name="forwarding-type"
            options={forwardingOptions}
            onChange={handleForwardingOptionChange}
          />
        </Island>
        <IslandDescription>
          {isChannel
            ? oldLang('ChannelVisibility.Forwarding.ChannelInfo')
            : oldLang('ChannelVisibility.Forwarding.GroupInfo')}
        </IslandDescription>
      </div>
      <FloatingActionButton
        isShown={canUpdate}
        disabled={isLoading}
        ariaLabel={oldLang('Save')}
        onClick={handleSave}
        iconName="check"
        isLoading={isLoading}
      />
      <ConfirmDialog
        isOpen={isUsernameLostDialogOpen}
        onClose={closeUsernameLostDialog}
        text={oldLang('ChannelVisibility.Confirm.MakePrivate.Channel', currentUsername)}
        confirmHandler={handleMakeChannelPrivateConfirm}
        confirmIsDestructive
      />
      <Modal
        className="confirm"
        title={lang('GuardApplyToInvitesTitle')}
        isOpen={isApplyToInvitesDialogOpen}
        onClose={closeApplyToInvitesDialog}
        isNativeDialog
        noTitleAutoFocus
      >
        <div tabIndex={-1} autoFocus>
          {lang(
            getApplyToInvitesKey(Boolean(pendingJoinRequest), isChannel),
            { count: invitesCount ?? 0 },
            { pluralValue: invitesCount ?? 0, withNodes: true, withMarkdown: true },
          )}
        </div>
        <div className="dialog-buttons mt-2">
          <Button isText inline className="confirm-dialog-button" onClick={handleApplyToInvites}>
            {lang('GuardApplyToInvitesApply')}
          </Button>
          <Button isText className="confirm-dialog-button" onClick={handleDontApplyToInvites}>
            {lang('GuardApplyToInvitesDontApply')}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

function getApplyToInvitesKey(isEnabling: boolean, isChannel: boolean) {
  if (isEnabling) {
    return isChannel ? 'GuardApplyToInvitesChannel' : 'GuardApplyToInvitesGroup';
  }
  return isChannel ? 'GuardDisableInvitesChannel' : 'GuardDisableInvitesGroup';
}

function getApprovalInfoKey(isChannel: boolean, isPublic: boolean) {
  if (isChannel) {
    return 'GuardApproveNewChannelSubscribersInfo';
  }
  return isPublic ? 'GuardApproveNewPublicGroupMembersInfo' : 'GuardApproveNewPrivateGroupMembersInfo';
}

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): Complete<StateProps> => {
    const chat = selectChat(global, chatId)!;
    const { isUsernameAvailable, checkedUsername, error } = selectManagement(global, chatId);
    const fullInfo = selectChatFullInfo(global, chatId);
    const guardBotId = fullInfo?.guardBotId;

    return {
      chat,
      isChannel: isChatChannel(chat),
      progress: selectTabState(global).management.progress,
      error,
      isUsernameAvailable,
      checkedUsername,
      isProtected: chat?.isProtected,
      isJoinRequest: chat?.isJoinRequest,
      guardBot: guardBotId ? selectUser(global, guardBotId) : undefined,
      invitesCount: selectTabState(global).management.byChatId[chatId]?.invites?.length,
      areInvitesLoaded: selectTabState(global).management.byChatId[chatId]?.invites !== undefined,
      maxPublicLinks: selectCurrentLimit(global, 'channelsPublic'),
      privateInviteLink: fullInfo?.inviteLink,
    };
  },
  (global, { chatId }) => {
    return Boolean(selectChat(global, chatId) && selectManagement(global, chatId));
  },
)(ManageChatPrivacyType));
