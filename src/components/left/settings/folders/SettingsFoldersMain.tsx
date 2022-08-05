import type { FC } from '../../../../lib/teact/teact';
import React, {
  memo, useMemo, useCallback, useEffect, useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiChatFolder } from '../../../../api/types';

import { ALL_FOLDER_ID, STICKER_SIZE_FOLDER_SETTINGS } from '../../../../config';
import { LOCAL_TGS_URLS } from '../../../common/helpers/animatedAssets';
import { MEMO_EMPTY_ARRAY } from '../../../../util/memo';
import { throttle } from '../../../../util/schedulers';
import { getFolderDescriptionText } from '../../../../global/helpers';
import useLang from '../../../../hooks/useLang';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import { useFolderManagerForChatsCount } from '../../../../hooks/useFolderManager';
import { selectCurrentLimit } from '../../../../global/selectors/limits';
import { selectIsCurrentUserPremium } from '../../../../global/selectors';

import ListItem from '../../../ui/ListItem';
import Button from '../../../ui/Button';
import Loading from '../../../ui/Loading';
import AnimatedIcon from '../../../common/AnimatedIcon';
import Draggable from '../../../ui/Draggable';

type OwnProps = {
  isActive?: boolean;
  onCreateFolder: () => void;
  onEditFolder: (folder: ApiChatFolder) => void;
  onReset: () => void;
};

type StateProps = {
  folderIds?: number[];
  foldersById: Record<number, ApiChatFolder>;
  recommendedChatFolders?: ApiChatFolder[];
  maxFolders: number;
  isPremium?: boolean;
};

type SortState = {
  orderedFolderIds?: number[];
  dragOrderIds?: number[];
  draggedIndex?: number;
};

const FOLDER_HEIGHT_PX = 68;
const runThrottledForLoadRecommended = throttle((cb) => cb(), 60000, true);

const SettingsFoldersMain: FC<OwnProps & StateProps> = ({
  isActive,
  onCreateFolder,
  onEditFolder,
  onReset,
  folderIds,
  foldersById,
  isPremium,
  recommendedChatFolders,
  maxFolders,
}) => {
  const {
    loadRecommendedChatFolders,
    addChatFolder,
    openLimitReachedModal,
    openDeleteChatFolderModal,
    sortChatFolders,
  } = getActions();

  const [state, setState] = useState<SortState>({
    orderedFolderIds: folderIds,
    dragOrderIds: folderIds,
    draggedIndex: undefined,
  });

  // Due to the parent Transition, this component never gets unmounted,
  // that's why we use throttled API call on every update.
  useEffect(() => {
    runThrottledForLoadRecommended(() => {
      loadRecommendedChatFolders();
    });
  }, [loadRecommendedChatFolders]);

  const handleCreateFolder = useCallback(() => {
    if (Object.keys(foldersById).length >= maxFolders - 1) {
      openLimitReachedModal({
        limit: 'dialogFilters',
      });

      return;
    }

    onCreateFolder();
  }, [foldersById, maxFolders, onCreateFolder, openLimitReachedModal]);

  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const chatsCountByFolderId = useFolderManagerForChatsCount();
  const userFolders = useMemo(() => {
    if (!state.orderedFolderIds) {
      return undefined;
    }

    if (state.orderedFolderIds.length <= 1) {
      return MEMO_EMPTY_ARRAY;
    }

    return state.orderedFolderIds.map((id) => {
      const folder = foldersById[id];

      if (id === ALL_FOLDER_ID) {
        return {
          id,
          title: lang('FilterAllChats'),
        };
      }

      return {
        id: folder.id,
        title: folder.title,
        subtitle: getFolderDescriptionText(lang, folder, chatsCountByFolderId[folder.id]),
      };
    });
  }, [state.orderedFolderIds, foldersById, lang, chatsCountByFolderId]);

  const handleCreateFolderFromRecommended = useCallback((folder: ApiChatFolder) => {
    if (Object.keys(foldersById).length >= maxFolders - 1) {
      openLimitReachedModal({
        limit: 'dialogFilters',
      });

      return;
    }

    addChatFolder({ folder });
  }, [foldersById, maxFolders, addChatFolder, openLimitReachedModal]);

  const handleDrag = useCallback((translation: { x: number; y: number }, id: number) => {
    const delta = Math.round(translation.y / FOLDER_HEIGHT_PX);
    const index = state.orderedFolderIds?.indexOf(id) || 0;
    const dragOrderIds = state.orderedFolderIds?.filter((folderId) => folderId !== id);

    if (!dragOrderIds || !inRange(index + delta, 0, folderIds?.length || 0)) {
      return;
    }

    dragOrderIds.splice(index + delta + (isPremium ? 0 : 1), 0, id);
    setState((current) => ({
      ...current,
      draggedIndex: index,
      dragOrderIds,
    }));
  }, [folderIds?.length, isPremium, state.orderedFolderIds]);

  const handleDragEnd = useCallback(() => {
    setState((current) => {
      sortChatFolders({ folderIds: current.dragOrderIds! });

      return {
        ...current,
        orderedFolderIds: current.dragOrderIds,
        draggedIndex: undefined,
      };
    });
  }, [sortChatFolders]);

  const canCreateNewFolder = useMemo(() => {
    return !isPremium || Object.keys(foldersById).length < maxFolders - 1;
  }, [foldersById, isPremium, maxFolders]);

  return (
    <div className="settings-content no-border custom-scroll">
      <div className="settings-content-header">
        <AnimatedIcon
          size={STICKER_SIZE_FOLDER_SETTINGS}
          tgsUrl={LOCAL_TGS_URLS.FoldersAll}
          className="settings-content-icon"
        />

        <p className="settings-item-description mb-3" dir="auto">
          {lang('CreateNewFilterInfo')}
        </p>

        {canCreateNewFolder && (
          <Button
          // TODO: Refactor button component to handle icon placemenet with props
            className="with-icon mb-2"
            color="primary"
            size="smaller"
            pill
            fluid
            onClick={handleCreateFolder}
            isRtl={lang.isRtl}
          >
            <i className="icon-add" />
            {lang('CreateNewFilter')}
          </Button>
        )}
      </div>

      <div className="settings-item pt-3">
        <h4 className="settings-item-header mb-3" dir={lang.isRtl ? 'rtl' : undefined}>{lang('Filters')}</h4>

        <div className="settings-sortable-container" style={`height: ${(folderIds?.length || 0) * FOLDER_HEIGHT_PX}px`}>
          {userFolders?.length ? userFolders.map((folder, i) => {
            const isBlocked = i > maxFolders - 1;
            const isDragged = state.draggedIndex === i;
            const draggedTop = (state.orderedFolderIds?.indexOf(folder.id) ?? 0) * FOLDER_HEIGHT_PX;
            const top = (state.dragOrderIds?.indexOf(folder.id) ?? 0) * FOLDER_HEIGHT_PX;

            if (folder.id === ALL_FOLDER_ID) {
              return (
                <Draggable
                  key={folder.id}
                  id={folder.id}
                  onDrag={handleDrag}
                  onDragEnd={handleDragEnd}
                  style={`top: ${isDragged ? draggedTop : top}px;`}
                  knobStyle={`${lang.isRtl ? 'left' : 'right'}: 0.375rem;`}
                  isDisabled={!isPremium || !isActive}
                >
                  <ListItem
                    key={folder.id}
                    className="mb-2 no-icon settings-sortable-item"
                    narrow
                    inactive
                    multiline
                    isStatic
                  >
                    <span className="title">
                      {folder.title}
                    </span>
                    <span className="subtitle">{lang('FoldersAllChatsDesc')}</span>
                  </ListItem>
                </Draggable>
              );
            }

            return (
              <Draggable
                key={folder.id}
                id={folder.id}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                style={`top: ${isDragged ? draggedTop : top}px;`}
                knobStyle={`${lang.isRtl ? 'left' : 'right'}: 3rem;`}
                isDisabled={isBlocked || !isActive}
              >
                <ListItem
                  className="mb-2 no-icon settings-sortable-item"
                  narrow
                  secondaryIcon="more"
                  multiline
                  contextActions={[
                    {
                      handler: () => {
                        openDeleteChatFolderModal({ folderId: folder.id });
                      },
                      destructive: true,
                      title: lang('Delete'),
                      icon: 'delete',
                    },
                  ]}
                  // eslint-disable-next-line react/jsx-no-bind
                  onClick={() => {
                    if (isBlocked) {
                      openLimitReachedModal({
                        limit: 'dialogFilters',
                      });
                    } else {
                      onEditFolder(foldersById[folder.id]);
                    }
                  }}
                >
                  <span className="title">
                    {folder.title}
                    {isBlocked && <i className="icon-lock-badge settings-folders-blocked-icon" />}
                  </span>
                  <span className="subtitle">{folder.subtitle}</span>
                </ListItem>
              </Draggable>
            );
          }) : userFolders && !userFolders.length ? (
            <p className="settings-item-description my-4" dir="auto">
              You have no folders yet.
            </p>
          ) : <Loading />}
        </div>
      </div>

      {(recommendedChatFolders && Boolean(recommendedChatFolders.length)) && (
        <div className="settings-item pt-3">
          <h4 className="settings-item-header mb-3" dir={lang.isRtl ? 'rtl' : undefined}>
            {lang('FilterRecommended')}
          </h4>

          {recommendedChatFolders.map((folder) => (
            <ListItem
              className="mb-2"
              narrow
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => handleCreateFolderFromRecommended(folder)}
            >
              <div className="settings-folders-recommended-item">
                <div className="multiline-item">
                  <span className="title">{folder.title}</span>
                  <span className="subtitle">{folder.description}</span>
                </div>

                <Button
                  className="px-3"
                  color="primary"
                  size="tiny"
                  pill
                  fluid
                  isRtl={lang.isRtl}
                >
                  {lang('Add')}
                </Button>
              </div>
            </ListItem>
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      orderedIds: folderIds,
      byId: foldersById,
      recommended: recommendedChatFolders,
    } = global.chatFolders;

    return {
      folderIds,
      foldersById,
      isPremium: selectIsCurrentUserPremium(global),
      recommendedChatFolders,
      maxFolders: selectCurrentLimit(global, 'dialogFilters'),
    };
  },
)(SettingsFoldersMain));

function inRange(x: number, min: number, max: number) {
  return x >= min && x <= max;
}
