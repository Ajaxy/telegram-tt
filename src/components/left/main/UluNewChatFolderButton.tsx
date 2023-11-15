import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChatFolder } from '../../../api/types';

import { selectIsCurrentUserPremium } from '../../../global/selectors';
import { selectCurrentLimit } from '../../../global/selectors/limits';

import Button from '../../ui/Button';
import UluChatFoldersWrapper from './UluChatFoldersWrapper';

import styles from './UluNewChatFolderButton.module.scss';

type OwnProps = {
  onCreateFolder: () => void;
};
type StateProps = {
  folderIds?: number[];
  foldersById: Record<number, ApiChatFolder>;
  recommendedChatFolders?: ApiChatFolder[];
  maxFolders: number;
  isPremium?: boolean;
};

const UluNewChatFolderButton: FC<OwnProps & StateProps> = ({ onCreateFolder, foldersById, maxFolders }) => {
  const { openLimitReachedModal } = getActions();

  const handleCreateFolder = useCallback(() => {
    if (Object.keys(foldersById).length >= maxFolders - 1) {
      openLimitReachedModal({
        limit: 'dialogFilters',
      });

      return;
    }

    onCreateFolder();
  }, [foldersById, maxFolders, onCreateFolder, openLimitReachedModal]);

  return (
    <UluChatFoldersWrapper className={styles.wrapper}>
      <Button className={styles.btn} color="gray" onClick={handleCreateFolder}>
        <div className={styles['plus-icon-wrapper']}>
          <div className={styles['plus-icon']} />
        </div>
        <div className={styles.text}>Create new...</div>
      </Button>
    </UluChatFoldersWrapper>
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
)(UluNewChatFolderButton));
