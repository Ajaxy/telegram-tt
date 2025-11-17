import type { FC } from '../../../../lib/teact/teact';
import type React from '../../../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import type {
  FolderEditDispatch,
  FoldersState,
} from '../../../../hooks/reducers/useFoldersReducer';
import {
  type ApiChatlistExportedInvite,
  type ApiMessageEntity,
  type ApiMessageEntityCustomEmoji,
  ApiMessageEntityTypes,
  type ApiSticker,
} from '../../../../api/types';

import { FOLDER_TITLE_MAX_LENGTH, STICKER_SIZE_FOLDER_SETTINGS } from '../../../../config';
import { selectCanShareFolder, selectCustomEmoji, selectIsCurrentUserPremium } from '../../../../global/selectors';
import { selectCurrentLimit } from '../../../../global/selectors/limits';
import buildClassName from '../../../../util/buildClassName';
import { isUserId } from '../../../../util/entities/ids';
import { findIntersectionWithSet } from '../../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../../util/memo';
import { CUSTOM_PEER_EXCLUDED_CHAT_TYPES, CUSTOM_PEER_INCLUDED_CHAT_TYPES } from '../../../../util/objects/customPeer';
import { LOCAL_TGS_URLS } from '../../../common/helpers/animatedAssets';
import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';

import { selectChatFilters } from '../../../../hooks/reducers/useFoldersReducer';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import useLastCallback from '../../../../hooks/useLastCallback';
import useOldLang from '../../../../hooks/useOldLang';
import { getPeerColorClass } from '../../../../hooks/usePeerColor';

import AnimatedIconWithPreview from '../../../common/AnimatedIconWithPreview';
import FolderIcon from '../../../common/FolderIcon';
import GroupChatInfo from '../../../common/GroupChatInfo';
import Icon from '../../../common/icons/Icon';
import PrivateChatInfo from '../../../common/PrivateChatInfo';
import FloatingActionButton from '../../../ui/FloatingActionButton';
import InputText from '../../../ui/InputText';
import ListItem from '../../../ui/ListItem';
import FolderIconPickerMenu from './FolderIconPickerMenu';

type OwnProps = {
  state: FoldersState;
  dispatch: FolderEditDispatch;
  onAddIncludedChats: VoidFunction;
  onAddExcludedChats: VoidFunction;
  onShareFolder: VoidFunction;
  onOpenInvite: (url: string) => void;
  isActive?: boolean;
  isOnlyInvites?: boolean;
  onReset: () => void;
  onBack: () => void;
  onSaveFolder: (cb?: VoidFunction) => void;
  isMobile?: boolean;
};

type StateProps = {
  loadedActiveChatIds?: string[];
  loadedArchivedChatIds?: string[];
  invites?: ApiChatlistExportedInvite[];
  isRemoved?: boolean;
  maxInviteLinks: number;
  maxChatLists: number;
  chatListCount: number;
  isCurrentUserPremium: boolean;
};

const SUBMIT_TIMEOUT = 500;

const INITIAL_CHATS_LIMIT = 5;

const FOLDER_COLORS = [0, 1, 2, 3, 4, 5, 6];

export const ERROR_NO_TITLE = 'Please provide a title for this folder.';
export const ERROR_NO_CHATS = 'ChatList.Filter.Error.Empty';

const DEFAULT_FOLDER_ICON = '🗂';

const SettingsFoldersEdit: FC<OwnProps & StateProps> = ({
  state,
  dispatch,
  onAddIncludedChats,
  onAddExcludedChats,
  onShareFolder,
  onOpenInvite,
  isActive,
  onReset,
  isRemoved,
  onBack,
  loadedActiveChatIds,
  isOnlyInvites,
  loadedArchivedChatIds,
  invites,
  maxInviteLinks,
  maxChatLists,
  chatListCount,
  onSaveFolder,
  isCurrentUserPremium,
  isMobile,
}) => {
  const {
    loadChatlistInvites,
    openLimitReachedModal,
    showNotification,
    openPremiumModal,
  } = getActions();

  const isCreating = state.mode === 'create';
  const isEditingChatList = state.folder.isChatList;

  const [isIncludedChatsListExpanded, setIsIncludedChatsListExpanded] = useState(false);
  const [isExcludedChatsListExpanded, setIsExcludedChatsListExpanded] = useState(false);
  const [isIconPickerMenuOpen, setIsIconPickerMenuOpen] = useState(false);

  useEffect(() => {
    if (isRemoved) {
      onReset();
    }
  }, [isRemoved, onReset]);

  useEffect(() => {
    if (isActive && state.folderId && state.folder.isChatList) {
      loadChatlistInvites({ folderId: state.folderId });
    }
  }, [isActive, state.folder.isChatList, state.folderId]);

  const {
    selectedChatIds: includedChatIds,
    selectedChatTypes: includedChatTypes,
  } = useMemo(() => selectChatFilters(state, 'included'), [state]);
  const {
    selectedChatIds: excludedChatIds,
    selectedChatTypes: excludedChatTypes,
  } = useMemo(() => selectChatFilters(state, 'excluded'), [state]);

  useEffect(() => {
    setIsIncludedChatsListExpanded(false);
    setIsExcludedChatsListExpanded(false);
  }, [state.folderId]);

  const [visibleIncludedChatIds, visibleExcludedChatIds] = useMemo(() => {
    const allLoadedChatsSet = new Set([
      ...(loadedActiveChatIds || []),
      ...(loadedArchivedChatIds || []),
    ]);

    const loadedIncludedChatIds = findIntersectionWithSet(includedChatIds, allLoadedChatsSet);
    const loadedExcludedChatIds = findIntersectionWithSet(excludedChatIds, allLoadedChatsSet);

    return [
      isIncludedChatsListExpanded
        ? loadedIncludedChatIds
        : loadedIncludedChatIds.slice(0, INITIAL_CHATS_LIMIT - includedChatTypes.length),
      isExcludedChatsListExpanded
        ? loadedExcludedChatIds
        : loadedExcludedChatIds.slice(0, INITIAL_CHATS_LIMIT - excludedChatTypes.length),
    ];
  }, [
    excludedChatIds, includedChatIds, includedChatTypes, excludedChatTypes,
    isExcludedChatsListExpanded, isIncludedChatsListExpanded,
    loadedActiveChatIds, loadedArchivedChatIds,
  ]);

  const lang = useOldLang();

  useHistoryBack({
    isActive,
    onBack,
  });

  const currentCustomEmoji = useMemo(() => state.folder.title.entities?.find(
    (entity): entity is ApiMessageEntityCustomEmoji =>
      entity.type === ApiMessageEntityTypes.CustomEmoji && entity.offset === 0,
  ), [state.folder.title]);

  const folderTitleMaxLength = useMemo(() => {
    return FOLDER_TITLE_MAX_LENGTH - (currentCustomEmoji ? currentCustomEmoji.length : 0);
  }, [currentCustomEmoji]);

  const setEmoticon = useCallback((_emoticon: string | ApiSticker) => {
    let text = state.folder.title.text;
    const entities: ApiMessageEntity[] = [];
    let emoticon = DEFAULT_FOLDER_ICON;
    if (currentCustomEmoji) {
      const { offset, length } = currentCustomEmoji;
      text = text.replace(text.substring(offset, offset + length), '');
    }
    if (typeof _emoticon === 'string') {
      emoticon = _emoticon;
    } else {
      const { id, emoji } = _emoticon;

      entities.push({
        type: ApiMessageEntityTypes.CustomEmoji,
        documentId: id,
        offset: 0,
        length: emoji?.length || 2,
      });
      if (emoji) {
        text = `${emoji}${text}`;
        emoticon = emoji;
        if (text.length > folderTitleMaxLength) {
          text = text.slice(0, folderTitleMaxLength);
        }
      }
    }

    dispatch({ type: 'setEmoticon', payload: emoticon });
    dispatch({ type: 'setTitle', payload: {
      text,
      entities,
    } });
  }, [dispatch, currentCustomEmoji, state.folder.title, folderTitleMaxLength]);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { currentTarget } = event;

    let title = currentTarget.value;

    if (currentCustomEmoji) {
      const { emoji } = selectCustomEmoji(getGlobal(), currentCustomEmoji.documentId);
      title = `${emoji}${title}`;
    }

    dispatch({ type: 'setTitle', payload: {
      text: title,
      entities: currentCustomEmoji ? [currentCustomEmoji] : [],
    } });
  }, [dispatch, currentCustomEmoji]);

  const handleSubmit = useCallback(() => {
    dispatch({ type: 'setIsLoading', payload: true });

    onSaveFolder(() => {
      setTimeout(() => {
        onReset();
      }, SUBMIT_TIMEOUT);
    });
  }, [dispatch, onSaveFolder, onReset]);

  const handleCreateInviteClick = useCallback(() => {
    if (!invites) {
      if (isCreating) {
        onSaveFolder(onShareFolder);
      }
      return;
    }

    // Ignoring global updates is a known drawback here
    if (!selectCanShareFolder(getGlobal(), state.folderId!)) {
      showNotification({ message: lang('ChatList.Filter.InviteLink.IncludeExcludeError') });
      return;
    }

    if (chatListCount >= maxChatLists && !state.folder.isChatList) {
      openLimitReachedModal({
        limit: 'chatlistJoined',
      });
      return;
    }

    if (invites.length < maxInviteLinks) {
      if (state.isTouched) {
        onSaveFolder(onShareFolder);
      } else {
        onShareFolder();
      }
      return;
    }

    openLimitReachedModal({
      limit: 'chatlistInvites',
    });
  }, [
    invites, state.folderId, state.isTouched, chatListCount, maxInviteLinks, isCreating, onSaveFolder,
    onShareFolder, lang, maxChatLists, state.folder.isChatList,
  ]);

  const handleEditInviteClick = useCallback((e: React.MouseEvent<HTMLElement>, url: string) => {
    if (state.isTouched) {
      onSaveFolder(() => onOpenInvite(url));
    } else {
      onOpenInvite(url);
    }
  }, [onSaveFolder, onOpenInvite, state.isTouched]);

  function renderChatType(key: string, mode: 'included' | 'excluded') {
    const chatType = mode === 'included'
      ? CUSTOM_PEER_INCLUDED_CHAT_TYPES.find(({ type: typeKey }) => typeKey === key)
      : CUSTOM_PEER_EXCLUDED_CHAT_TYPES.find(({ type: typeKey }) => typeKey === key);

    if (!chatType) {
      return undefined;
    }

    return (
      <ListItem
        key={chatType.type}
        className="settings-folders-list-item mb-1"
        narrow
        inactive
      >
        <PrivateChatInfo
          avatarSize="small"
          customPeer={chatType}
        />
      </ListItem>
    );
  }

  function renderChats(mode: 'included' | 'excluded') {
    const selectedChatTypes = mode === 'included' ? includedChatTypes : excludedChatTypes;
    const visibleChatIds = mode === 'included' ? visibleIncludedChatIds : visibleExcludedChatIds;

    const isExpanded = mode === 'included' ? isIncludedChatsListExpanded : isExcludedChatsListExpanded;
    const allChatIds = mode === 'included' ? includedChatIds : excludedChatIds;
    const leftChatsCount = allChatIds.length - visibleChatIds.length;
    const clickHandler = mode === 'included'
      ? () => setIsIncludedChatsListExpanded(true)
      : () => setIsExcludedChatsListExpanded(true);

    return (
      <>
        {selectedChatTypes.map((key) => renderChatType(key, mode))}
        {visibleChatIds.map((id) => (
          <ListItem
            className="settings-folders-list-item mb-1"
            narrow
            inactive
          >
            {isUserId(id) ? (
              <PrivateChatInfo avatarSize="small" userId={id} />
            ) : (
              <GroupChatInfo avatarSize="small" chatId={id} />
            )}
          </ListItem>
        ))}
        {(!isExpanded && leftChatsCount > 0) && (
          <ListItem
            key="load-more"
            className="settings-folders-list-item"
            narrow

            onClick={clickHandler}
            icon="down"
          >
            {lang('FilterShowMoreChats', leftChatsCount, 'i')}
          </ListItem>
        )}
      </>
    );
  }

  const handleEmojiSelect = useLastCallback((emoji: string | ApiSticker) => {
    setEmoticon(emoji);
  });

  const handleIconPickerClose = useLastCallback(() => {
    setIsIconPickerMenuOpen(false);
  });

  const handleIconPickerOpen = useLastCallback(() => {
    setIsIconPickerMenuOpen(true);
  });

  const titleText = useMemo(() => {
    let title = state.folder.title.text;
    if (currentCustomEmoji) {
      const { offset, length } = currentCustomEmoji;
      title = title.substring(offset + length, title.length);
    }
    return title;
  }, [state.folder.title.text, currentCustomEmoji]);

  return (
    <div className="settings-fab-wrapper">
      <div className="settings-content no-border custom-scroll">
        <div className="settings-content-header">
          <AnimatedIconWithPreview
            size={STICKER_SIZE_FOLDER_SETTINGS}
            tgsUrl={LOCAL_TGS_URLS.FoldersNew}
            play={String(state.folderId)}
            className="settings-content-icon"
          />

          {isCreating && (
            <p className="settings-item-description mb-3" dir={lang.isRtl ? 'rtl' : undefined}>
              {lang('FilterIncludeInfo')}
            </p>
          )}
          <div className="settings-folders-input-container">
            <InputText
              className={buildClassName('mb-0', !isMobile && 'settings-folders-input-with-icon')}
              label={lang('FilterNameHint')}
              value={titleText}
              maxLength={folderTitleMaxLength}
              onChange={handleChange}
              error={state.error && state.error === ERROR_NO_TITLE ? ERROR_NO_TITLE : undefined}
            />

            {!isMobile && (
              <div className="settings-folders-icon-picker" dir={lang.isRtl ? 'rtl' : undefined}>
                <div
                  className="settings-folders-icon-picker-button"
                  onClick={handleIconPickerOpen}
                >
                  <FolderIcon
                    emoji={state.folder.emoticon}
                    customEmojiId={currentCustomEmoji?.documentId}
                    shouldAnimate={state.folder.noTitleAnimations}
                  />
                </div>
                <FolderIconPickerMenu
                  isOpen={isIconPickerMenuOpen}
                  onEmojiSelect={handleEmojiSelect}
                  onClose={handleIconPickerClose}
                />
              </div>
            )}
          </div>
        </div>

        {!isOnlyInvites && (
          <div className="settings-item">
            {state.error && state.error === ERROR_NO_CHATS && (
              <p className="settings-item-description color-danger mb-2" dir={lang.isRtl ? 'rtl' : undefined}>
                {lang(state.error)}
              </p>
            )}

            <h4 className="settings-item-header mb-3" dir={lang.isRtl ? 'rtl' : undefined}>{lang('FilterInclude')}</h4>

            <ListItem
              className="settings-folders-list-item color-primary"
              icon="add"
              narrow
              onClick={onAddIncludedChats}
            >
              {lang('FilterAddChats')}
            </ListItem>

            {renderChats('included')}
          </div>
        )}

        {!isOnlyInvites && !isEditingChatList && (
          <div className="settings-item pt-3">
            <h4 className="settings-item-header mb-3" dir={lang.isRtl ? 'rtl' : undefined}>{lang('FilterExclude')}</h4>

            <ListItem
              className="settings-folders-list-item color-primary"
              icon="add"
              narrow
              onClick={onAddExcludedChats}
            >
              {lang('FilterAddChats')}
            </ListItem>

            {renderChats('excluded')}
          </div>
        )}

        <div className="settings-item pt-3">
          <h4 className="settings-item-header mb-3 color-picker-header" dir={lang.isRtl ? 'rtl' : undefined}>
            <span className="color-picker-title-text">{lang('FilterColorTitle')}</span>
            <div className={buildClassName(
              'color-picker-title',
              'color-picker-selected-color',
              isCurrentUserPremium && state.folder.color !== undefined && state.folder.color !== -1
                ? getPeerColorClass(state.folder.color)
                : 'color-picker-item-disabled',
            )}
            >
              {renderTextWithEntities({
                text: state.folder.title.text,
                entities: state.folder.title.entities,
                noCustomEmojiPlayback: state.folder.noTitleAnimations,
              })}
            </div>
          </h4>
          <div className="color-picker custom-scroll-x">
            {FOLDER_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  if (!isCurrentUserPremium) {
                    openPremiumModal();
                    return;
                  }

                  dispatch({ type: 'setColor', payload: color });
                }}
                className={buildClassName(
                  'color-picker-item',
                  getPeerColorClass(color),
                  !isCurrentUserPremium && 'color-picker-item-hover-disabled',
                  color === state.folder.color && isCurrentUserPremium && 'color-picker-item-active',
                )}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                if (!isCurrentUserPremium) {
                  openPremiumModal();
                  return;
                }

                dispatch({ type: 'setColor', payload: undefined });
              }}
              className={buildClassName(
                'color-picker-item',
                'color-picker-item-none',
                (state.folder.color === undefined || state.folder.color === -1 || !isCurrentUserPremium)
                && 'color-picker-item-active',
              )}
            >
              {isCurrentUserPremium ? (
                <Icon name="close" className="color-picker-item-none-icon" />
              ) : (
                <Icon name="lock-badge" className="color-picker-item-none-icon" />
              )}
            </button>
          </div>
          <p className="settings-item-description mb-0 mt-3" dir={lang.isRtl ? 'rtl' : undefined}>
            {lang('FilterColorHint')}
          </p>
        </div>

        <div className="settings-item pt-3">
          <h4 className="settings-item-header mb-3" dir={lang.isRtl ? 'rtl' : undefined}>
            {lang('FolderLinkScreen.Title')}
          </h4>

          <ListItem
            className="settings-folders-list-item color-primary"
            icon="add"
            narrow
            onClick={handleCreateInviteClick}
          >
            {lang('ChatListFilter.CreateLinkNew')}
          </ListItem>

          {invites?.map((invite) => (
            <ListItem
              className="settings-folders-list-item"
              icon="link"
              narrow
              multiline
              onClick={handleEditInviteClick}
              clickArg={invite.url}
            >
              <span className="title" dir="auto">{invite.title || invite.url}</span>
              <span className="subtitle">
                {lang('ChatListFilter.LinkLabelChatCount', invite.peerIds.length, 'i')}
              </span>
            </ListItem>
          ))}

        </div>
      </div>

      <FloatingActionButton
        isShown={Boolean(state.isTouched)}
        disabled={state.isLoading}
        onClick={handleSubmit}
        ariaLabel={state.mode === 'edit' ? 'Save changes' : 'Create folder'}
        iconName="check"
        isLoading={state.isLoading}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { state }): Complete<StateProps> => {
    const { listIds } = global.chats;
    const { byId, invites } = global.chatFolders;
    const chatListCount = Object.values(byId).reduce((acc, el) => acc + (el.isChatList ? 1 : 0), 0);

    const isCurrentUserPremium = selectIsCurrentUserPremium(global);

    return {
      loadedActiveChatIds: listIds.active,
      loadedArchivedChatIds: listIds.archived,
      invites: state.folderId ? (invites[state.folderId] || MEMO_EMPTY_ARRAY) : undefined,
      isRemoved: state.folderId !== undefined && !byId[state.folderId],
      maxInviteLinks: selectCurrentLimit(global, 'chatlistInvites'),
      maxChatLists: selectCurrentLimit(global, 'chatlistJoined'),
      chatListCount,
      isCurrentUserPremium,
    };
  },
)(SettingsFoldersEdit));
