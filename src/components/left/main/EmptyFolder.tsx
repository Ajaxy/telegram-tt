import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiChatFolder, ApiSticker } from '../../../api/types';
import type { FolderEditDispatch } from '../../../hooks/reducers/useFoldersReducer';
import { SettingsScreens } from '../../../types';

import { selectAnimatedEmoji, selectChatFolder } from '../../../global/selectors';

import useAppLayout from '../../../hooks/useAppLayout';
import useLang from '../../../hooks/useLang';

import AnimatedIconFromSticker from '../../common/AnimatedIconFromSticker';
import Button from '../../ui/Button';

import styles from './EmptyFolder.module.scss';

type FolderType = 'all' | 'archived' | 'folder';

type OwnProps = {
  folderId?: number;
  folderType: FolderType;
  isInbox?: boolean;
  foldersDispatch: FolderEditDispatch;
  onSettingsScreenSelect: (screen: SettingsScreens) => void;
};

type StateProps = {
  chatFolder?: ApiChatFolder;
  folderType?: FolderType;
  isInbox?: boolean;
  animatedEmoji?: ApiSticker;
};

const ICON_SIZE = 96;

const EmptyFolder: FC<OwnProps & StateProps> = ({
  chatFolder, isInbox, animatedEmoji, foldersDispatch, onSettingsScreenSelect,
}) => {
  const lang = useLang();
  const { isMobile } = useAppLayout();

  const handleEditFolder = useCallback(() => {
    foldersDispatch({ type: 'editFolder', payload: chatFolder });
    onSettingsScreenSelect(SettingsScreens.FoldersEditFolderFromChatList);
  }, [chatFolder, foldersDispatch, onSettingsScreenSelect]);

  return (
    <div className={styles.root}>
      <div className={styles.sticker}>
        {animatedEmoji && <AnimatedIconFromSticker sticker={animatedEmoji} size={ICON_SIZE} />}
      </div>
      <h3 className={styles.title} dir="auto">{isInbox ? lang('InboxIsEmpty') : lang('FilterNoChatsToDisplay')}</h3>
      <p className={styles.description} dir="auto">
        {lang(chatFolder ? 'ChatList.EmptyChatListFilterText' : 'Chat.EmptyChat')}
      </p>
      {chatFolder && (
        <Button
          ripple={!isMobile}
          fluid
          pill
          onClick={handleEditFolder}
          size="smaller"
          isRtl={lang.isRtl}
        >
          <i className="icon icon-settings" />
          <div className={styles.buttonText}>
            {lang('ChatList.EmptyChatListEditFilter')}
          </div>
        </Button>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global, { folderId, folderType, isInbox }): StateProps => {
  const chatFolder = folderId && folderType === 'folder' ? selectChatFolder(global, folderId) : undefined;

  return {
    chatFolder,
    isInbox,
    animatedEmoji: selectAnimatedEmoji(global, '📂'),
  };
})(EmptyFolder));
