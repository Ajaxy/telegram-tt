import type { FC } from '../../../../lib/teact/teact';
import React, {
  memo, useMemo, useCallback, useEffect,
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

type OwnProps = {
  isActive?: boolean;
  onCreateFolder: () => void;
  onEditFolder: (folder: ApiChatFolder) => void;
  onReset: () => void;
};

type StateProps = {
  orderedFolderIds?: number[];
  foldersById: Record<number, ApiChatFolder>;
  recommendedChatFolders?: ApiChatFolder[];
  maxFolders: number;
  isPremium?: boolean;
};

const runThrottledForLoadRecommended = throttle((cb) => cb(), 60000, true);

const SettingsFoldersMain: FC<OwnProps & StateProps> = ({
  isActive,
  onCreateFolder,
  onEditFolder,
  onReset,
  orderedFolderIds,
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
  } = getActions();

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
    if (!orderedFolderIds) {
      return undefined;
    }

    if (orderedFolderIds.length <= 1) {
      return MEMO_EMPTY_ARRAY;
    }

    return orderedFolderIds.map((id) => {
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
  }, [orderedFolderIds, foldersById, lang, chatsCountByFolderId]);

  const handleCreateFolderFromRecommended = useCallback((folder: ApiChatFolder) => {
    if (Object.keys(foldersById).length >= maxFolders - 1) {
      openLimitReachedModal({
        limit: 'dialogFilters',
      });

      return;
    }

    addChatFolder({ folder });
  }, [foldersById, maxFolders, addChatFolder, openLimitReachedModal]);

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

        {userFolders?.length ? userFolders.map((folder, i) => {
          const isBlocked = i > maxFolders - 1;
          if (folder.id === ALL_FOLDER_ID) {
            return (
              <ListItem
                className="mb-2 no-icon"
                narrow
                inactive
                isStatic
              >
                {folder.title}
              </ListItem>
            );
          }

          return (
            <ListItem
              className="mb-2 no-icon"
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
          );
        }) : userFolders && !userFolders.length ? (
          <p className="settings-item-description my-4" dir="auto">
            You have no folders yet.
          </p>
        ) : <Loading />}
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
      orderedIds: orderedFolderIds,
      byId: foldersById,
      recommended: recommendedChatFolders,
    } = global.chatFolders;

    return {
      orderedFolderIds,
      foldersById,
      isPremium: selectIsCurrentUserPremium(global),
      recommendedChatFolders,
      maxFolders: selectCurrentLimit(global, 'dialogFilters'),
    };
  },
)(SettingsFoldersMain));
