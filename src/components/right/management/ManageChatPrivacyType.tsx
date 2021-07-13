import React, {
  FC, memo, useCallback, useEffect, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { ApiChat } from '../../../api/types';
import { ManagementProgress } from '../../../types';

import { selectChat, selectManagement } from '../../../modules/selectors';
import { pick } from '../../../util/iteratees';
import { isChatChannel } from '../../../modules/helpers';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';

import SafeLink from '../../common/SafeLink';
import ListItem from '../../ui/ListItem';
import RadioGroup from '../../ui/RadioGroup';
import Loading from '../../ui/Loading';
import Spinner from '../../ui/Spinner';
import FloatingActionButton from '../../ui/FloatingActionButton';
import UsernameInput from '../../common/UsernameInput';
import ConfirmDialog from '../../ui/ConfirmDialog';

type PrivacyType = 'private' | 'public';

type OwnProps = {
  chatId: number;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  chat: ApiChat;
  isChannel: boolean;
  progress?: ManagementProgress;
  isUsernameAvailable?: boolean;
};

type DispatchProps = Pick<GlobalActions, (
  'checkPublicLink' | 'updatePublicLink' | 'updatePrivateLink'
)>;

const ManageChatPrivacyType: FC<OwnProps & StateProps & DispatchProps> = ({
  chat,
  onClose,
  isActive,
  isChannel,
  progress,
  isUsernameAvailable,
  checkPublicLink,
  updatePublicLink,
  updatePrivateLink,
}) => {
  const isPublic = Boolean(chat.username);
  const privateLink = chat.fullInfo && chat.fullInfo.inviteLink;

  const [privacyType, setPrivacyType] = useState<PrivacyType>(isPublic ? 'public' : 'private');
  const [username, setUsername] = useState();
  const [isRevokeConfirmDialogOpen, openRevokeConfirmDialog, closeRevokeConfirmDialog] = useFlag();

  const canUpdate = (
    (privacyType === 'public' && username && isUsernameAvailable)
    || (privacyType === 'private' && isPublic)
  );

  useHistoryBack(isActive, onClose);

  useEffect(() => {
    if (privacyType && !privateLink) {
      updatePrivateLink();
    }
  }, [privacyType, privateLink, updatePrivateLink]);

  const handleOptionChange = useCallback((value: string) => {
    setPrivacyType(value as PrivacyType);
  }, []);

  const handleSave = useCallback(() => {
    updatePublicLink({ username: privacyType === 'public' ? username : '' });
  }, [privacyType, updatePublicLink, username]);

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

  const isLoading = progress === ManagementProgress.InProgress;

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
              currentUsername={chat.username}
              isLoading={isLoading}
              isUsernameAvailable={isUsernameAvailable}
              checkUsername={checkPublicLink}
              onChange={setUsername}
            />
            <p className="section-info" dir="auto">
              {lang(`${langPrefix2}.Username.CreatePublicLinkHelp`)}
            </p>
          </div>
        )}
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
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId)!;
    const { isUsernameAvailable } = selectManagement(global, chatId)!;

    return {
      chat,
      isChannel: isChatChannel(chat),
      progress: global.management.progress,
      isUsernameAvailable,
    };
  },
  (setGlobal, actions) => pick(actions, [
    'checkPublicLink', 'updatePublicLink', 'updatePrivateLink',
  ]),
)(ManageChatPrivacyType));
