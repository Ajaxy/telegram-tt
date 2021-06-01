import React, {
  FC, memo, useMemo, useCallback, useState, useEffect,
} from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../lib/teact/teactn';

import { GlobalActions } from '../../../../global/types';
import { ApiChatFolder, ApiChat, ApiUser } from '../../../../api/types';
import { NotifyException, NotifySettings } from '../../../../types';

import { STICKER_SIZE_FOLDER_SETTINGS } from '../../../../config';
import { pick } from '../../../../util/iteratees';
import { selectNotifyExceptions, selectNotifySettings } from '../../../../modules/selectors';
import { throttle } from '../../../../util/schedulers';
import getAnimationData from '../../../common/helpers/animatedAssets';
import { getFolderDescriptionText } from '../../../../modules/helpers';
import useLang from '../../../../hooks/useLang';

import ListItem from '../../../ui/ListItem';
import Button from '../../../ui/Button';
import Loading from '../../../ui/Loading';
import AnimatedSticker from '../../../common/AnimatedSticker';

type OwnProps = {
  onCreateFolder: () => void;
  onEditFolder: (folder: ApiChatFolder) => void;
};

type StateProps = {
  chatsById: Record<number, ApiChat>;
  usersById: Record<number, ApiUser>;
  orderedFolderIds?: number[];
  foldersById: Record<number, ApiChatFolder>;
  recommendedChatFolders?: ApiChatFolder[];
  notifySettings: NotifySettings;
  notifyExceptions?: Record<number, NotifyException>;
};

type DispatchProps = Pick<GlobalActions, 'loadRecommendedChatFolders' | 'addChatFolder' | 'showError'>;

const runThrottledForLoadRecommended = throttle((cb) => cb(), 60000, true);

const MAX_ALLOWED_FOLDERS = 10;

const SettingsFoldersMain: FC<OwnProps & StateProps & DispatchProps> = ({
  onCreateFolder,
  onEditFolder,
  chatsById,
  usersById,
  orderedFolderIds,
  foldersById,
  recommendedChatFolders,
  notifySettings,
  notifyExceptions,
  loadRecommendedChatFolders,
  addChatFolder,
  showError,
}) => {
  const [animationData, setAnimationData] = useState<Record<string, any>>();
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
      showError({
        error: {
          message: 'DIALOG_FILTERS_TOO_MUCH',
        },
      });

      return;
    }

    onCreateFolder();
  }, [foldersById, showError, onCreateFolder]);

  const lang = useLang();

  const userFolders = useMemo(() => {
    if (!orderedFolderIds) {
      return undefined;
    }

    const chatIds = Object.keys(chatsById).map(Number);

    return orderedFolderIds.map((id) => {
      const folder = foldersById[id];

      return {
        id: folder.id,
        title: folder.title,
        subtitle: getFolderDescriptionText(
          chatsById, usersById, folder, chatIds, lang, notifySettings, notifyExceptions,
        ),
      };
    });
  }, [orderedFolderIds, chatsById, foldersById, usersById, notifySettings, notifyExceptions, lang]);

  const handleCreateFolderFromRecommended = useCallback((folder: ApiChatFolder) => {
    if (Object.keys(foldersById).length >= MAX_ALLOWED_FOLDERS) {
      showError({
        error: {
          message: 'DIALOG_FILTERS_TOO_MUCH',
        },
      });

      return;
    }

    addChatFolder({ folder });
  }, [foldersById, addChatFolder, showError]);

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

        <p className="settings-item-description mb-3">
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
        >
          <i className="icon-add" />
          {lang('CreateNewFilter')}
        </Button>
      </div>

      <div className="settings-item pt-3">
        <h4 className="settings-item-header mb-3">{lang('Filters')}</h4>

        {userFolders && userFolders.length ? userFolders.map((folder) => (
          <ListItem
            className="mb-2"
            narrow
            multiline
            onClick={() => onEditFolder(foldersById[folder.id])}
          >
            <span className="title">{folder.title}</span>
            <span className="subtitle">{folder.subtitle}</span>
          </ListItem>
        )) : userFolders && !userFolders.length ? (
          <p className="settings-item-description my-4">
            You have no folders yet.
          </p>
        ) : <Loading />}
      </div>

      {(recommendedChatFolders && !!recommendedChatFolders.length) && (
        <div className="settings-item pt-3">
          <h4 className="settings-item-header mb-3">{lang('FilterRecommended')}</h4>

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
      chats: { byId: chatsById },
      users: { byId: usersById },
    } = global;

    const {
      orderedIds: orderedFolderIds,
      byId: foldersById,
      recommended: recommendedChatFolders,
    } = global.chatFolders;

    return {
      chatsById,
      usersById,
      orderedFolderIds,
      foldersById,
      recommendedChatFolders,
      notifySettings: selectNotifySettings(global),
      notifyExceptions: selectNotifyExceptions(global),
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['loadRecommendedChatFolders', 'addChatFolder', 'showError']),
)(SettingsFoldersMain));
