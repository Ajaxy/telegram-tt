import type { ChangeEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiChat } from '../../../api/types';
import { ManagementProgress } from '../../../types';

import { PURCHASE_USERNAME, TME_LINK_PREFIX, USERNAME_PURCHASE_ERROR } from '../../../config';
import { selectChat, selectManagement } from '../../../global/selectors';
import { isChatChannel, isChatPublic } from '../../../global/helpers';
import { selectCurrentLimit } from '../../../global/selectors/limits';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';
import usePrevious from '../../../hooks/usePrevious';

import SafeLink from '../../common/SafeLink';
import ListItem from '../../ui/ListItem';
import RadioGroup from '../../ui/RadioGroup';
import Loading from '../../ui/Loading';
import Spinner from '../../ui/Spinner';
import FloatingActionButton from '../../ui/FloatingActionButton';
import UsernameInput from '../../common/UsernameInput';
import ConfirmDialog from '../../ui/ConfirmDialog';
import ManageUsernames from '../../common/ManageUsernames';

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
  maxPublicLinks: number;
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
  maxPublicLinks,
  onClose,
}) => {
  const {
    updatePublicLink,
    updatePrivateLink,
    toggleIsProtected,
    openLimitReachedModal,
  } = getActions();

  const firstEditableUsername = useMemo(() => chat.usernames?.find(({ isEditable }) => isEditable), [chat.usernames]);
  const currentUsername = firstEditableUsername?.username || '';
  const isPublic = useMemo(() => isChatPublic(chat), [chat]);
  const privateLink = chat.fullInfo?.inviteLink;

  const [isProfileFieldsTouched, setIsProfileFieldsTouched] = useState(false);
  const [privacyType, setPrivacyType] = useState<PrivacyType>(isPublic ? 'public' : 'private');
  const [editableUsername, setEditableUsername] = useState();
  const [isRevokeConfirmDialogOpen, openRevokeConfirmDialog, closeRevokeConfirmDialog] = useFlag();
  const [isUsernameLostDialogOpen, openUsernameLostDialog, closeUsernameLostDialog] = useFlag();

  const previousIsUsernameAvailable = usePrevious(isUsernameAvailable);
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
    if (privacyType && !privateLink) {
      updatePrivateLink();
    }
  }, [privacyType, privateLink, updatePrivateLink]);

  const handleUsernameChange = useCallback((value: string) => {
    setEditableUsername(value);
    setIsProfileFieldsTouched(true);
  }, []);

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

  const handleSave = useCallback(() => {
    if (isPublic && privacyType === 'private') {
      openUsernameLostDialog();
    } else {
      updatePublicLink({ username: privacyType === 'public' ? editableUsername : '' });
    }
  }, [isPublic, openUsernameLostDialog, privacyType, updatePublicLink, editableUsername]);

  const handleMakeChannelPrivateConfirm = useCallback(() => {
    updatePublicLink({ username: '' });
    closeUsernameLostDialog();
  }, [closeUsernameLostDialog, updatePublicLink]);

  const handleRevokePrivateLink = useCallback(() => {
    closeRevokeConfirmDialog();
    updatePrivateLink();
  }, [closeRevokeConfirmDialog, updatePrivateLink]);

  const lang = useLang();
  const langPrefix1 = isChannel ? 'Channel' : 'Mega';
  const langPrefix2 = isChannel ? 'Channel' : 'Group';

  const options = [
    { value: 'private', label: lang(`${langPrefix1}Private`), subLabel: lang(`${langPrefix1}PrivateInfo`) },
    { value: 'public', label: lang(`${langPrefix1}Public`), subLabel: lang(`${langPrefix1}PublicInfo`) },
  ];

  const forwardingOptions = [{
    value: 'allowed',
    label: lang('ChannelVisibility.Forwarding.Enabled'),
  }, {
    value: 'protected',
    label: lang('ChannelVisibility.Forwarding.Disabled'),
  }];

  const isLoading = progress === ManagementProgress.InProgress;
  const shouldRenderUsernamesManage = privacyType === 'public' && chat.usernames && chat.usernames.length > 1;

  function renderPurchaseLink() {
    const purchaseInfoLink = `${TME_LINK_PREFIX}${PURCHASE_USERNAME}`;

    return (
      <p className="section-info" dir="auto">
        {(lang('lng_username_purchase_available') as string)
          .replace('{link}', '%PURCHASE_LINK%')
          .split('%')
          .map((s) => {
            return (s === 'PURCHASE_LINK' ? <SafeLink url={purchaseInfoLink} text={`@${PURCHASE_USERNAME}`} /> : s);
          })}
      </p>
    );
  }

  return (
    <div className="Management">
      <div className="custom-scroll">
        <div className="section" dir={lang.isRtl ? 'rtl' : undefined}>
          <h3 className="section-heading">{lang(`${langPrefix2}Type`)}</h3>
          <RadioGroup
            selected={privacyType}
            name="channel-type"
            options={options}
            onChange={handleOptionChange}
          />
        </div>
        {privacyType === 'private' ? (
          <div className="section" dir={lang.isRtl ? 'rtl' : undefined}>
            {privateLink ? (
              <>
                <SafeLink url={privateLink} className="group-link" text={privateLink} />
                <p className="section-info" dir={lang.isRtl ? 'rtl' : undefined}>
                  {lang(`${langPrefix1}PrivateLinkHelp`)}
                </p>

                <ListItem icon="delete" ripple destructive onClick={openRevokeConfirmDialog}>
                  {lang('RevokeLink')}
                </ListItem>
                <ConfirmDialog
                  isOpen={isRevokeConfirmDialogOpen}
                  onClose={closeRevokeConfirmDialog}
                  text={lang('RevokeAlert')}
                  confirmLabel={lang('RevokeButton')}
                  confirmHandler={handleRevokePrivateLink}
                  confirmIsDestructive
                />
              </>
            ) : (
              <Loading />
            )}
          </div>
        ) : (
          <div className="section no-border">
            <UsernameInput
              asLink
              currentUsername={currentUsername}
              isLoading={isLoading}
              isUsernameAvailable={isUsernameAvailable}
              checkedUsername={checkedUsername}
              onChange={handleUsernameChange}
            />
            {error === USERNAME_PURCHASE_ERROR && renderPurchaseLink()}
            <p className="section-info" dir="auto">
              {lang(`${langPrefix2}.Username.CreatePublicLinkHelp`)}
            </p>
          </div>
        )}
        {shouldRenderUsernamesManage && (
          <ManageUsernames
            chatId={chat.id}
            usernames={chat.usernames!}
            onEditUsername={handleUsernameChange}
          />
        )}
        <div className="section" dir={lang.isRtl ? 'rtl' : undefined}>
          <h3 className="section-heading">
            {lang(isChannel ? 'ChannelVisibility.Forwarding.ChannelTitle' : 'ChannelVisibility.Forwarding.GroupTitle')}
          </h3>
          <RadioGroup
            selected={isProtected ? 'protected' : 'allowed'}
            name="forwarding-type"
            options={forwardingOptions}
            onChange={handleForwardingOptionChange}
          />
          <p className="section-info">
            {isChannel
              ? lang('ChannelVisibility.Forwarding.ChannelInfo')
              : lang('ChannelVisibility.Forwarding.GroupInfo')}
          </p>
        </div>
      </div>
      <FloatingActionButton
        isShown={canUpdate}
        disabled={isLoading}
        ariaLabel={lang('Save')}
        onClick={handleSave}
      >
        {isLoading ? (
          <Spinner color="white" />
        ) : (
          <i className="icon-check" />
        )}
      </FloatingActionButton>
      <ConfirmDialog
        isOpen={isUsernameLostDialogOpen}
        onClose={closeUsernameLostDialog}
        text={lang('ChannelVisibility.Confirm.MakePrivate.Channel', currentUsername)}
        confirmHandler={handleMakeChannelPrivateConfirm}
        confirmIsDestructive
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId)!;
    const { isUsernameAvailable, checkedUsername, error } = selectManagement(global, chatId)!;

    return {
      chat,
      isChannel: isChatChannel(chat),
      progress: global.management.progress,
      error,
      isUsernameAvailable,
      checkedUsername,
      isProtected: chat?.isProtected,
      maxPublicLinks: selectCurrentLimit(global, 'channelsPublic'),
    };
  },
)(ManageChatPrivacyType));
