import React, {
  FC, memo, useCallback, useEffect, useMemo, useState,
} from '../../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../../lib/teact/teactn';

import { SettingsScreens } from '../../../../types';

import { STICKER_SIZE_FOLDER_SETTINGS } from '../../../../config';
import { findIntersectionWithSet } from '../../../../util/iteratees';
import { isUserId } from '../../../../modules/helpers';
import getAnimationData from '../../../common/helpers/animatedAssets';
import {
  EXCLUDED_CHAT_TYPES,
  FolderEditDispatch,
  FoldersState,
  INCLUDED_CHAT_TYPES,
  selectChatFilters,
} from '../../../../hooks/reducers/useFoldersReducer';
import useLang from '../../../../hooks/useLang';
import useHistoryBack from '../../../../hooks/useHistoryBack';

import ListItem from '../../../ui/ListItem';
import AnimatedSticker from '../../../common/AnimatedSticker';
import InputText from '../../../ui/InputText';
import PrivateChatInfo from '../../../common/PrivateChatInfo';
import GroupChatInfo from '../../../common/GroupChatInfo';
import FloatingActionButton from '../../../ui/FloatingActionButton';
import Spinner from '../../../ui/Spinner';
import ShowMoreButton from '../../../ui/ShowMoreButton';

type OwnProps = {
  state: FoldersState;
  dispatch: FolderEditDispatch;
  onAddIncludedChats: () => void;
  onAddExcludedChats: () => void;
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
  onBack: () => void;
};

type StateProps = {
  loadedActiveChatIds?: string[];
  loadedArchivedChatIds?: string[];
};

const SUBMIT_TIMEOUT = 500;

const INITIAL_CHATS_LIMIT = 5;

const ERROR_NO_TITLE = 'Please provide a title for this folder.';
const ERROR_NO_CHATS = 'ChatList.Filter.Error.Empty';

const SettingsFoldersEdit: FC<OwnProps & StateProps> = ({
  state,
  dispatch,
  onAddIncludedChats,
  onAddExcludedChats,
  isActive,
  onScreenSelect,
  onReset,
  onBack,
  loadedActiveChatIds,
  loadedArchivedChatIds,
}) => {
  const {
    editChatFolder,
    addChatFolder,
    loadMoreChats,
  } = getDispatch();

  const [animationData, setAnimationData] = useState<string>();
  const [isAnimationLoaded, setIsAnimationLoaded] = useState(false);
  const handleAnimationLoad = useCallback(() => setIsAnimationLoaded(true), []);

  const [isIncludedChatsListExpanded, setIsIncludedChatsListExpanded] = useState(false);
  const [isExcludedChatsListExpanded, setIsExcludedChatsListExpanded] = useState(false);

  const {
    selectedChatIds: includedChatIds,
    selectedChatTypes: includedChatTypes,
  } = selectChatFilters(state, 'included');
  const {
    selectedChatIds: excludedChatIds,
    selectedChatTypes: excludedChatTypes,
  } = selectChatFilters(state, 'excluded');

  useEffect(() => {
    if (!animationData) {
      getAnimationData('FoldersNew').then(setAnimationData);
    }
  }, [animationData]);

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

  useEffect(() => {
    if (
      visibleIncludedChatIds.length < includedChatIds.length
      || visibleExcludedChatIds.length < excludedChatIds.length
    ) {
      loadMoreChats({ listType: 'active' });
    }
  }, [
    loadMoreChats,
    excludedChatIds.length,
    includedChatIds.length,
    visibleExcludedChatIds.length,
    visibleIncludedChatIds.length,
  ]);

  const lang = useLang();

  useHistoryBack(isActive, onBack, onScreenSelect, state.mode === 'edit'
    ? SettingsScreens.FoldersEditFolder
    : SettingsScreens.FoldersCreateFolder);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { currentTarget } = event;
    dispatch({ type: 'setTitle', payload: currentTarget.value.trim() });
  }

  function handleSubmit() {
    const { title } = state.folder;

    if (!title) {
      dispatch({ type: 'setError', payload: ERROR_NO_TITLE });
      return;
    }

    if (!includedChatIds.length && !Object.keys(includedChatTypes).length) {
      dispatch({ type: 'setError', payload: ERROR_NO_CHATS });
      return;
    }

    dispatch({ type: 'setIsLoading', payload: true });
    if (state.mode === 'edit') {
      editChatFolder({ id: state.folderId, folderUpdate: state.folder });
    } else {
      addChatFolder({ folder: state.folder });
    }

    setTimeout(() => {
      onReset();
    }, SUBMIT_TIMEOUT);
  }

  function renderChatType(key: string, mode: 'included' | 'excluded') {
    const chatType = mode === 'included'
      ? INCLUDED_CHAT_TYPES.find(({ key: typeKey }) => typeKey === key)
      : EXCLUDED_CHAT_TYPES.find(({ key: typeKey }) => typeKey === key);

    if (!chatType) {
      return undefined;
    }

    return (
      <ListItem
        key={chatType.key}
        className="settings-folders-list-item mb-1"
        icon={chatType.icon}
        narrow
        inactive
      >
        {lang(chatType.title)}
      </ListItem>
    );
  }

  function renderChats(mode: 'included' | 'excluded') {
    const selectedChatTypes = mode === 'included' ? includedChatTypes : excludedChatTypes;
    const visibleChatIds = mode === 'included' ? visibleIncludedChatIds : visibleExcludedChatIds;

    const isExpanded = mode === 'included' ? isIncludedChatsListExpanded : isExcludedChatsListExpanded;
    const allChatIds = mode === 'included' ? includedChatIds : excludedChatIds;
    const leftChatsCount = allChatIds.length - selectedChatTypes.length - visibleChatIds.length;
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
          <ShowMoreButton
            count={leftChatsCount}
            itemName="chat"
            onClick={clickHandler}
          />
        )}
      </>
    );
  }

  return (
    <div className="settings-fab-wrapper">
      <div className="settings-content custom-scroll">
        <div className="settings-content-header">
          <div className="settings-content-icon">
            {animationData && (
              <AnimatedSticker
                id="settingsFoldersEdit"
                size={STICKER_SIZE_FOLDER_SETTINGS}
                animationData={animationData}
                play={isAnimationLoaded && String(state.folderId)}
                noLoop
                onLoad={handleAnimationLoad}
              />
            )}
          </div>

          {state.mode === 'create' && (
            <p className="settings-item-description mb-3" dir={lang.isRtl ? 'rtl' : undefined}>
              {lang('FilterIncludeInfo')}
            </p>
          )}

          <InputText
            className="mb-0"
            label={lang('FilterNameHint')}
            value={state.folder.title}
            onChange={handleChange}
            error={state.error && state.error === ERROR_NO_TITLE ? ERROR_NO_TITLE : undefined}
          />
        </div>

        <div className="settings-item no-border pt-3">
          {state.error && state.error === ERROR_NO_CHATS && (
            <p className="settings-item-description color-danger mb-2" dir={lang.isRtl ? 'rtl' : undefined}>
              {lang(state.error)}
            </p>
          )}

          <h4 className="settings-item-header mb-3" dir={lang.isRtl ? 'rtl' : undefined}>{lang('FilterInclude')}</h4>

          <ListItem
            className="settings-folders-list-item color-primary mb-0"
            icon="add"
            onClick={onAddIncludedChats}
          >
            {lang('FilterAddChats')}
          </ListItem>

          {renderChats('included')}
        </div>

        <div className="settings-item no-border pt-3">
          <h4 className="settings-item-header mb-3" dir={lang.isRtl ? 'rtl' : undefined}>{lang('FilterExclude')}</h4>

          <ListItem
            className="settings-folders-list-item color-primary mb-0"
            icon="add"
            onClick={onAddExcludedChats}
          >
            {lang('FilterAddChats')}
          </ListItem>

          {renderChats('excluded')}
        </div>
      </div>

      <FloatingActionButton
        isShown={!!state.isTouched}
        disabled={state.isLoading}
        onClick={handleSubmit}
        ariaLabel={state.mode === 'edit' ? 'Save changes' : 'Create folder'}
      >
        {state.isLoading ? (
          <Spinner color="white" />
        ) : (
          <i className="icon-check" />
        )}
      </FloatingActionButton>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { listIds } = global.chats;

    return {
      loadedActiveChatIds: listIds.active,
      loadedArchivedChatIds: listIds.archived,
    };
  },
)(SettingsFoldersEdit));
