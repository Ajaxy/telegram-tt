import type { FC } from '../../../lib/teact/teact';
import { memo, useCallback } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChatFolder, ApiSticker } from '../../../api/types';
import type { FolderEditDispatch } from '../../../hooks/reducers/useFoldersReducer';
import { SettingsScreens } from '../../../types';

import { selectAnimatedEmoji, selectChatFolder } from '../../../global/selectors';

import useAppLayout from '../../../hooks/useAppLayout';
import useOldLang from '../../../hooks/useOldLang';

import AnimatedIconFromSticker from '../../common/AnimatedIconFromSticker';
import Button from '../../ui/Button';

import styles from './EmptyFolder.module.scss';

type OwnProps = {
  folderId?: number;
  folderType: 'all' | 'archived' | 'saved' | 'folder';
  foldersDispatch: FolderEditDispatch;
};

type StateProps = {
  chatFolder?: ApiChatFolder;
  animatedEmoji?: ApiSticker;
};

const ICON_SIZE = 96;

const EmptyFolder: FC<OwnProps & StateProps> = ({
  chatFolder, animatedEmoji, foldersDispatch,
}) => {
  const { openSettingsScreen } = getActions();
  const lang = useOldLang();
  const { isMobile } = useAppLayout();

  const handleEditFolder = useCallback(() => {
    foldersDispatch({ type: 'editFolder', payload: chatFolder });
    openSettingsScreen({ screen: SettingsScreens.FoldersEditFolderFromChatList });
  }, [chatFolder, foldersDispatch]);

  return (
    <div className={styles.root}>
      <div className={styles.sticker}>
        {animatedEmoji && <AnimatedIconFromSticker sticker={animatedEmoji} size={ICON_SIZE} />}
      </div>
      <h3 className={styles.title} dir="auto">{lang('FilterNoChatsToDisplay')}</h3>
      <p className={styles.description} dir="auto">
        {lang(chatFolder ? 'ChatList.EmptyChatListFilterText' : 'Chat.EmptyChat')}
      </p>
      {chatFolder && (
        <Button
          ripple={!isMobile}
          fluid
          pill
          iconName="settings"
          onClick={handleEditFolder}
          isRtl={lang.isRtl}
        >
          <div className={styles.buttonText}>
            {lang('ChatList.EmptyChatListEditFilter')}
          </div>
        </Button>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global, { folderId, folderType }): Complete<StateProps> => {
  const chatFolder = folderId && folderType === 'folder' ? selectChatFolder(global, folderId) : undefined;

  return {
    chatFolder,
    animatedEmoji: selectAnimatedEmoji(global, '📂'),
  };
})(EmptyFolder));
