import type { ChangeEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiAvailableReaction, ApiChat, ApiChatBannedRights, ApiChatFullInfo, ApiExportedInvite,
} from '../../../api/types';
import { ApiMediaFormat } from '../../../api/types';
import { ManagementProgress, ManagementScreens } from '../../../types';

import {
  getChatAvatarHash,
  getHasAdminRight,
  isChatBasicGroup,
  isChatPublic,
} from '../../../global/helpers';
import { selectChat, selectChatFullInfo, selectIsChatRestricted, selectTabState } from '../../../global/selectors';
import { debounce } from '../../../util/schedulers';
import { formatInteger } from '../../../util/textFormat';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useOldLang from '../../../hooks/useOldLang';

import AvatarEditable from '../../ui/AvatarEditable';
import Checkbox from '../../ui/Checkbox';
import ConfirmDialog from '../../ui/ConfirmDialog';
import FloatingActionButton from '../../ui/FloatingActionButton';
import InputText from '../../ui/InputText';
import ListItem from '../../ui/ListItem';
import Switcher from '../../ui/Switcher';
import TextArea from '../../ui/TextArea';

import './Management.scss';

type OwnProps = {
  chatId: string;
  onScreenSelect: (screen: ManagementScreens) => void;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  chat: ApiChat;
  chatFullInfo?: ApiChatFullInfo;
  progress?: ManagementProgress;
  isBasicGroup: boolean;
  hasLinkedChannel: boolean;
  canChangeInfo?: boolean;
  canBanUsers?: boolean;
  canInvite?: boolean;
  canEditForum?: boolean;
  exportedInvites?: ApiExportedInvite[];
  isChannelsPremiumLimitReached: boolean;
  availableReactions?: ApiAvailableReaction[];
};

const GROUP_TITLE_EMPTY = 'Group title can\'t be empty';
const GROUP_MAX_DESCRIPTION = 255;

const ALL_PERMISSIONS: Array<keyof ApiChatBannedRights> = [
  'sendMessages',
  'embedLinks',
  'sendPolls',
  'changeInfo',
  'inviteUsers',
  'pinMessages',
  'manageTopics',
  'sendPhotos',
  'sendVideos',
  'sendRoundvideos',
  'sendVoices',
  'sendAudios',
  'sendDocs',
];
// Some checkboxes control multiple rights, and some rights are not controlled from Permissions screen,
// so we need to define the amount manually
const TOTAL_PERMISSIONS_COUNT = ALL_PERMISSIONS.length + 1;

const runDebounced = debounce((cb) => cb(), 500, false);

const ManageGroup: FC<OwnProps & StateProps> = ({
  chatId,
  chat,
  chatFullInfo,
  progress,
  isBasicGroup,
  hasLinkedChannel,
  canChangeInfo,
  canBanUsers,
  canInvite,
  canEditForum,
  isActive,
  exportedInvites,
  isChannelsPremiumLimitReached,
  availableReactions,
  onScreenSelect,
  onClose,
}) => {
  const {
    togglePreHistoryHidden,
    updateChat,
    deleteChat,
    leaveChannel,
    deleteChannel,
    closeManagement,
    openChat,
    loadExportedChatInvites,
    loadChatJoinRequests,
    toggleForum,
  } = getActions();

  const [isDeleteDialogOpen, openDeleteDialog, closeDeleteDialog] = useFlag();
  const currentTitle = chat.title;
  const currentAbout = chatFullInfo?.about || '';

  const [isProfileFieldsTouched, setIsProfileFieldsTouched] = useState(false);
  const [title, setTitle] = useState(currentTitle);
  const [about, setAbout] = useState(currentAbout);
  const [photo, setPhoto] = useState<File | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isForumEnabled, setIsForumEnabled] = useState(chat.isForum);
  const imageHash = getChatAvatarHash(chat);
  const currentAvatarBlobUrl = useMedia(imageHash, false, ApiMediaFormat.BlobUrl);
  const isPublicGroup = useMemo(() => isChatPublic(chat), [chat]);
  const lang = useOldLang();
  const isPreHistoryHiddenCheckboxRef = useRef<HTMLDivElement>();

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  useEffect(() => {
    if (canInvite) {
      loadExportedChatInvites({ chatId });
      loadExportedChatInvites({ chatId, isRevoked: true });
      loadChatJoinRequests({ chatId });
    }
  }, [chatId, canInvite]);

  // Resetting `isForum` switch on flood wait error
  useEffect(() => {
    setIsForumEnabled(Boolean(chat.isForum));
  }, [chat.isForum]);

  useEffect(() => {
    if (progress === ManagementProgress.Complete) {
      setIsProfileFieldsTouched(false);
      setError(undefined);
    }
  }, [progress]);

  const handleClickEditType = useLastCallback(() => {
    onScreenSelect(ManagementScreens.ChatPrivacyType);
  });

  const handleClickDiscussion = useLastCallback(() => {
    onScreenSelect(ManagementScreens.Discussion);
  });

  const handleClickReactions = useLastCallback(() => {
    onScreenSelect(ManagementScreens.Reactions);
  });

  const handleClickPermissions = useLastCallback(() => {
    onScreenSelect(ManagementScreens.GroupPermissions);
  });

  const handleClickAdministrators = useLastCallback(() => {
    onScreenSelect(ManagementScreens.ChatAdministrators);
  });

  const handleClickInvites = useLastCallback(() => {
    onScreenSelect(ManagementScreens.Invites);
  });

  const handleClickRequests = useLastCallback(() => {
    onScreenSelect(ManagementScreens.JoinRequests);
  });

  const handleSetPhoto = useLastCallback((file: File) => {
    setPhoto(file);
    setIsProfileFieldsTouched(true);
  });

  const handleTitleChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setIsProfileFieldsTouched(true);
  });

  const handleAboutChange = useLastCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setAbout(e.target.value);
    setIsProfileFieldsTouched(true);
  });

  const handleUpdateGroup = useLastCallback(() => {
    const trimmedTitle = title.trim();
    const trimmedAbout = about.trim();

    if (!trimmedTitle.length) {
      setError(GROUP_TITLE_EMPTY);
      return;
    }

    updateChat({
      chatId,
      title: trimmedTitle,
      about: trimmedAbout,
      photo,
    });
  });

  const handleClickMembers = useLastCallback(() => {
    onScreenSelect(ManagementScreens.GroupMembers);
  });

  const handleTogglePreHistory = useLastCallback(() => {
    if (!chatFullInfo) {
      return;
    }

    const { isPreHistoryHidden } = chatFullInfo;

    togglePreHistoryHidden({ chatId: chat.id, isEnabled: !isPreHistoryHidden });
  });

  const handleForumToggle = useLastCallback(() => {
    setIsForumEnabled((current) => {
      const newIsForumEnabled = !current;

      runDebounced(() => {
        toggleForum({ chatId, isEnabled: newIsForumEnabled });
      });

      return newIsForumEnabled;
    });
  });

  useEffect(() => {
    if (!isChannelsPremiumLimitReached) {
      return;
    }

    // Teact does not have full support of controlled form components, we need to "disable" input value change manually
    // TODO Teact support added, this can now be removed
    const checkbox = isPreHistoryHiddenCheckboxRef.current?.querySelector('input') as HTMLInputElement;
    checkbox.checked = !chatFullInfo?.isPreHistoryHidden;
  }, [isChannelsPremiumLimitReached, chatFullInfo?.isPreHistoryHidden]);

  const chatReactionsDescription = useMemo(() => {
    if (!chatFullInfo?.enabledReactions) {
      return lang('ReactionsOff');
    }

    if (chatFullInfo.enabledReactions.type === 'all') {
      return lang('ReactionsAll');
    }

    const enabledLength = chatFullInfo.enabledReactions.allowed.length;
    const totalLength = availableReactions?.filter((reaction) => !reaction.isInactive).length || 0;

    return totalLength
      ? `${enabledLength} / ${totalLength}`
      : enabledLength.toString();
  }, [availableReactions, chatFullInfo?.enabledReactions, lang]);

  const enabledPermissionsCount = useMemo(() => {
    if (!chat.defaultBannedRights) {
      return 0;
    }

    let totalCount = ALL_PERMISSIONS.filter(
      (key) => {
        if (key === 'manageTopics' && !isForumEnabled) return false;
        return !chat.defaultBannedRights![key];
      },
    ).length;

    const { sendStickers, sendGifs } = chat.defaultBannedRights;

    // These two rights are controlled with a single checkbox
    if (!sendStickers && !sendGifs) {
      totalCount += 1;
    }

    return totalCount;
  }, [chat.defaultBannedRights, isForumEnabled]);

  const adminsCount = useMemo(() => {
    return Object.keys(chatFullInfo?.adminMembersById || {}).length;
  }, [chatFullInfo?.adminMembersById]);

  const handleDeleteGroup = useLastCallback(() => {
    if (isBasicGroup) {
      deleteChat({ chatId: chat.id });
    } else if (!chat.isCreator) {
      leaveChannel({ chatId: chat.id });
    } else {
      deleteChannel({ chatId: chat.id });
    }
    closeDeleteDialog();
    closeManagement();
    openChat({ id: undefined });
  });

  const isRestricted = selectIsChatRestricted(getGlobal(), chatId);
  if (isRestricted || chat.isForbidden) {
    return undefined;
  }

  const isLoading = progress === ManagementProgress.InProgress;

  return (
    <div className="Management">
      <div className="panel-content custom-scroll">
        <div className="section">
          <AvatarEditable
            isForForum={isForumEnabled}
            currentAvatarBlobUrl={currentAvatarBlobUrl}
            onChange={handleSetPhoto}
            disabled={!canChangeInfo}
          />
          <div className="settings-edit">
            <InputText
              id="group-title"
              label={lang('GroupName')}
              onChange={handleTitleChange}
              value={title}
              error={error === GROUP_TITLE_EMPTY ? error : undefined}
              disabled={!canChangeInfo}
            />
            <TextArea
              id="group-about"
              label={lang('DescriptionPlaceholder')}
              maxLength={GROUP_MAX_DESCRIPTION}
              maxLengthIndicator={(GROUP_MAX_DESCRIPTION - about.length).toString()}
              onChange={handleAboutChange}
              value={about}
              disabled={!canChangeInfo}
              noReplaceNewlines
            />
          </div>
          {chat.isCreator && (
            <ListItem icon="lock" multiline onClick={handleClickEditType}>
              <span className="title">{lang('GroupType')}</span>
              <span className="subtitle">{isPublicGroup ? lang('TypePublic') : lang('TypePrivate')}</span>
            </ListItem>
          )}
          {hasLinkedChannel && (
            <ListItem
              icon="message"
              multiline
              onClick={handleClickDiscussion}
            >
              <span className="title">{lang('LinkedChannel')}</span>
              <span className="subtitle">{lang('DiscussionUnlink')}</span>
            </ListItem>
          )}
          <ListItem
            icon="permissions"
            multiline
            onClick={handleClickPermissions}
            disabled={!canBanUsers}
          >
            <span className="title">{lang('ChannelPermissions')}</span>
            <span className="subtitle" dir="auto">
              {enabledPermissionsCount}
              /
              {TOTAL_PERMISSIONS_COUNT - (isForumEnabled ? 0 : 1)}
            </span>
          </ListItem>
          <ListItem
            icon="heart-outline"
            multiline
            onClick={handleClickReactions}
            disabled={!canChangeInfo}
          >
            <span className="title">{lang('Reactions')}</span>
            <span className="subtitle" dir="auto">
              {chatReactionsDescription}
            </span>
          </ListItem>
          <ListItem
            icon="admin"
            multiline
            onClick={handleClickAdministrators}
          >
            <span className="title">{lang('ChannelAdministrators')}</span>
            <span className="subtitle">{formatInteger(adminsCount)}</span>
          </ListItem>
          {canInvite && (
            <ListItem
              icon="link"
              onClick={handleClickInvites}
              multiline
              disabled={!exportedInvites}
            >
              <span className="title">{lang('GroupInfo.InviteLinks')}</span>
              <span className="subtitle">
                {exportedInvites ? formatInteger(exportedInvites.length) : lang('Loading')}
              </span>
            </ListItem>
          )}
          {Boolean(chat.joinRequests?.length) && (
            <ListItem
              icon="add-user-filled"
              onClick={handleClickRequests}
              multiline
            >
              <span className="title">{lang('MemberRequests')}</span>
              <span className="subtitle">
                {formatInteger(chat.joinRequests.length)}
              </span>
            </ListItem>
          )}
          {canEditForum && (
            <>
              <ListItem icon="forums" ripple onClick={handleForumToggle}>
                <span>{lang('ChannelTopics')}</span>
                <Switcher
                  id="group-notifications"
                  label={lang('ChannelTopics')}
                  checked={isForumEnabled}
                  inactive
                />
              </ListItem>
              <div className="section-info section-info_push">{lang('ForumToggleDescription')}</div>
            </>
          )}
        </div>
        <div className="section">
          <ListItem icon="group" multiline onClick={handleClickMembers}>
            <span className="title">{lang('GroupMembers')}</span>
            <span className="subtitle">{formatInteger(chat.membersCount ?? 0)}</span>
          </ListItem>

          {!isPublicGroup && !hasLinkedChannel && Boolean(chatFullInfo) && (
            <div className="ListItem narrow" ref={isPreHistoryHiddenCheckboxRef}>
              <Checkbox
                className="align-checkbox-with-list-buttons"
                checked={!chatFullInfo.isPreHistoryHidden}
                label={lang('ChatHistory')}
                onChange={handleTogglePreHistory}
                subLabel={
                  chatFullInfo.isPreHistoryHidden ? lang('ChatHistoryHiddenInfo2') : lang('ChatHistoryVisibleInfo')
                }
                disabled={!canBanUsers}
              />
            </div>
          )}
        </div>
        <div className="section">
          <ListItem icon="delete" ripple destructive onClick={openDeleteDialog}>
            {lang('DeleteMega')}
          </ListItem>
        </div>
      </div>
      <FloatingActionButton
        isShown={isProfileFieldsTouched}
        onClick={handleUpdateGroup}
        disabled={isLoading}
        ariaLabel={lang('Save')}
        iconName="check"
        isLoading={isLoading}
      />
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={closeDeleteDialog}
        textParts={renderText(
          isBasicGroup || !chat.isCreator
            ? lang('AreYouSureDeleteAndExit')
            : lang('AreYouSureDeleteThisChatWithGroup', chat.title),
          ['br', 'simple_markdown'],
        )}
        confirmLabel={isBasicGroup || !chat.isCreator ? lang('DeleteMega') : lang('DeleteGroupForAll')}
        confirmHandler={handleDeleteGroup}
        confirmIsDestructive
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): Complete<StateProps> => {
    const chat = selectChat(global, chatId)!;
    const chatFullInfo = selectChatFullInfo(global, chatId);
    const { management, limitReachedModal } = selectTabState(global);
    const { progress } = management;
    const hasLinkedChannel = Boolean(chatFullInfo?.linkedChatId);
    const isBasicGroup = isChatBasicGroup(chat);
    const { invites } = management.byChatId[chatId] || {};
    const canEditForum = !hasLinkedChannel && (getHasAdminRight(chat, 'changeInfo') || chat.isCreator);
    const canChangeInfo = chat.isCreator || getHasAdminRight(chat, 'changeInfo');
    const canBanUsers = chat.isCreator || getHasAdminRight(chat, 'banUsers');
    const canInvite = chat.isCreator || getHasAdminRight(chat, 'inviteUsers');

    return {
      chat,
      chatFullInfo,
      progress,
      isBasicGroup,
      hasLinkedChannel,
      canChangeInfo,
      canBanUsers,
      canInvite,
      exportedInvites: invites,
      isChannelsPremiumLimitReached: limitReachedModal?.limit === 'channels',
      availableReactions: global.reactions.availableReactions,
      canEditForum,
    };
  },
  (global, { chatId }) => {
    return Boolean(selectChat(global, chatId));
  },
)(ManageGroup));
