import React, {
  FC, memo, useMemo, useCallback, useState, useEffect,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import { ApiChatFolder } from '../../../../api/types';
import { SettingsScreens } from '../../../../types';

import { STICKER_SIZE_FOLDER_SETTINGS } from '../../../../config';
import { throttle } from '../../../../util/schedulers';
import getAnimationData from '../../../common/helpers/animatedAssets';
import { getFolderDescriptionText } from '../../../../global/helpers';
import useLang from '../../../../hooks/useLang';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import { useFolderManagerForChatsCount } from '../../../../hooks/useFolderManager';

import ListItem from '../../../ui/ListItem';
import Button from '../../../ui/Button';
import Loading from '../../../ui/Loading';
import AnimatedSticker from '../../../common/AnimatedSticker';

type OwnProps = {
  isActive?: boolean;
  onCreateFolder: () => void;
  onEditFolder: (folder: ApiChatFolder) => void;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps = {
  orderedFolderIds?: number[];
  foldersById: Record<number, ApiChatFolder>;
  recommendedChatFolders?: ApiChatFolder[];
};

const runThrottledForLoadRecommended = throttle((cb) => cb(), 60000, true);

const MAX_ALLOWED_FOLDERS = 10;

const SettingsFoldersMain: FC<OwnProps & StateProps> = ({
  isActive,
  onCreateFolder,
  onEditFolder,
  onScreenSelect,
  onReset,
  orderedFolderIds,
  foldersById,
  recommendedChatFolders,
}) => {
  const {
    loadRecommendedChatFolders,
    addChatFolder,
    showDialog,
  } = getActions();

  const [animationData, setAnimationData] = useState<string>();
  const [isAnimationLoaded, setIsAnimationLoaded] = useState(false);
  const handleAnimationLoad = useCallback(() => setIsAnimationLoaded(true), []);

  useEffect(() => {
    if (!animationData) {
      getAnimationData('FoldersAll').then(setAnimationData);
    }
  }, [animationData]);

  // Due to the parent Transition, this component never gets unmounted,
  // that's why we use throttled API call on every update.
  useEffect(() => {
    runThrottledForLoadRecommended(() => {
      loadRecommendedChatFolders();
    });
  }, [loadRecommendedChatFolders]);

  const handleCreateFolder = useCallback(() => {
    if (Object.keys(foldersById).length >= MAX_ALLOWED_FOLDERS) {
      showDialog({
        data: {
          message: 'DIALOG_FILTERS_TOO_MUCH',
          hasErrorKey: true,
        },
      });

      return;
    }

    onCreateFolder();
  }, [foldersById, showDialog, onCreateFolder]);

  const lang = useLang();

  useHistoryBack(isActive, onReset, onScreenSelect, SettingsScreens.Folders);

  const chatsCountByFolderId = useFolderManagerForChatsCount();
  const userFolders = useMemo(() => {
    if (!orderedFolderIds) {
      return undefined;
    }

    return orderedFolderIds.map((id) => {
      const folder = foldersById[id];

      return {
        id: folder.id,
        title: folder.title,
        subtitle: getFolderDescriptionText(lang, folder, chatsCountByFolderId[folder.id]),
      };
    });
  }, [orderedFolderIds, foldersById, lang, chatsCountByFolderId]);

  const handleCreateFolderFromRecommended = useCallback((folder: ApiChatFolder) => {
    if (Object.keys(foldersById).length >= MAX_ALLOWED_FOLDERS) {
      showDialog({
        data: {
          message: 'DIALOG_FILTERS_TOO_MUCH',
          hasErrorKey: true,
        },
      });

      return;
    }

    addChatFolder({ folder });
  }, [foldersById, addChatFolder, showDialog]);

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-content-header">
        <div className="settings-content-icon">
          {animationData && (
            <AnimatedSticker
              id="settingsFoldersMain"
              size={STICKER_SIZE_FOLDER_SETTINGS}
              animationData={animationData}
              play={isAnimationLoaded}
              noLoop
              onLoad={handleAnimationLoad}
            />
          )}
        </div>

        <p className="settings-item-description mb-3" dir="auto">
          {lang('CreateNewFilterInfo')}
        </p>

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
      </div>

      <div className="settings-item pt-3">
        <h4 className="settings-item-header mb-3" dir={lang.isRtl ? 'rtl' : undefined}>{lang('Filters')}</h4>

        {userFolders?.length ? userFolders.map((folder) => (
          <ListItem
            className="mb-2 no-icon"
            narrow
            multiline
            onClick={() => onEditFolder(foldersById[folder.id])}
          >
            <span className="title">{folder.title}</span>
            <span className="subtitle">{folder.subtitle}</span>
          </ListItem>
        )) : userFolders && !userFolders.length ? (
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
      recommendedChatFolders,
    };
  },
)(SettingsFoldersMain));
