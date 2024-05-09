import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChatFolder } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { selectChatFolder } from '../../../global/selectors';

import useLang from '../../../hooks/useLang';
import usePrevious from '../../../hooks/usePrevious';

import Modal from '../../ui/Modal';
import Tab from '../../ui/Tab';
import ChatlistAlready from './ChatlistAlready';
import ChatlistDelete from './ChatlistDelete';
import ChatlistNew from './ChatlistNew';

import styles from './ChatlistModal.module.scss';

export type OwnProps = {
  modal?: TabState['chatlistModal'];
};

type StateProps = {
  folder?: ApiChatFolder;
};

const ChatlistInviteModal: FC<OwnProps & StateProps> = ({
  modal,
  folder,
}) => {
  const { closeChatlistModal } = getActions();

  const lang = useLang();

  const isOpen = Boolean(modal);
  const renderingInfo = usePrevious(modal) || modal;
  const renderingFolder = usePrevious(folder) || folder;

  const title = useMemo(() => {
    if (!renderingInfo) return undefined;
    if (renderingInfo.invite) {
      const invite = renderingInfo.invite;
      if ('alreadyPeerIds' in invite) {
        return invite.missingPeerIds.length ? lang('FolderLinkTitleAddChats') : lang('FolderLinkTitleAlready');
      }
      return lang('FolderLinkTitleAdd');
    }
    if (renderingInfo.removal) {
      return lang('FolderLinkTitleRemove');
    }

    return undefined;
  }, [lang, renderingInfo]);

  const renderingFolderTitle = useMemo(() => {
    if (renderingFolder) return renderingFolder.title;
    if (renderingInfo?.invite && 'title' in renderingInfo.invite) return renderingInfo.invite.title;
    return undefined;
  }, [renderingFolder, renderingInfo]);

  const folderTabNumber = useMemo(() => {
    if (!renderingInfo?.invite) return undefined;
    if ('missingPeerIds' in renderingInfo.invite) return renderingInfo.invite.missingPeerIds.length;
    return undefined;
  }, [renderingInfo]);

  function renderFolders(folderTitle: string) {
    return (
      <div className={styles.foldersWrapper}>
        <div className={styles.folders}>
          <Tab className={styles.folder} title={lang('FolderLinkPreviewLeft')} />
          <Tab className={styles.folder} isActive badgeCount={folderTabNumber} isBadgeActive title={folderTitle} />
          <Tab className={styles.folder} title={lang('FolderLinkPreviewRight')} />
        </div>
      </div>
    );
  }

  const renderContent = useCallback(() => {
    if (!renderingInfo) return undefined;
    if (renderingInfo.invite) {
      const invite = renderingInfo.invite;
      if ('alreadyPeerIds' in invite) {
        return <ChatlistAlready invite={invite} folder={renderingFolder!} />;
      }

      return <ChatlistNew invite={invite} />;
    }

    if (renderingInfo.removal) {
      return <ChatlistDelete folder={renderingFolder!} suggestedPeerIds={renderingInfo.removal.suggestedPeerIds} />;
    }

    return undefined;
  }, [renderingFolder, renderingInfo]);

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onClose={closeChatlistModal}
      isSlim
      hasCloseButton
    >
      {renderingFolderTitle && renderFolders(renderingFolderTitle)}
      {renderContent()}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): StateProps => {
    const { invite, removal } = modal || {};
    const folderId = removal?.folderId || (invite && 'folderId' in invite ? invite.folderId : undefined);
    const folder = folderId ? selectChatFolder(global, folderId) : undefined;

    return {
      folder,
    };
  },
)(ChatlistInviteModal));
