import React, { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessage } from '../../../api/types';

import { formatDateAtTime } from '../../../util/dates/dateFormat';

import useOldLang from '../../../hooks/useOldLang';

import MenuItem from '../../ui/MenuItem';
import Skeleton from '../../ui/placeholder/Skeleton';
import Transition from '../../ui/Transition';

import styles from './TimeMenuItem.module.scss';

type OwnProps = {
  message: ApiMessage;
  shouldRenderShowWhen?: boolean;
  canLoadReadDate?: boolean;
  closeContextMenu: NoneToVoidFunction;
};

function ReadTimeMenuItem({
  message, shouldRenderShowWhen, canLoadReadDate, closeContextMenu,
}: OwnProps) {
  const { openPrivacySettingsNoticeModal } = getActions();
  const lang = useOldLang();
  const { readDate } = message;
  const shouldRenderSkeleton = canLoadReadDate && !readDate && !shouldRenderShowWhen;

  const handleOpenModal = () => {
    closeContextMenu();
    openPrivacySettingsNoticeModal({ chatId: message.chatId, isReadDate: true });
  };

  return (
    <MenuItem icon="message-read" className={styles.item}>
      <Transition name="fade" activeKey={shouldRenderSkeleton ? 1 : 2} className={styles.transition}>
        {shouldRenderSkeleton ? <Skeleton className={styles.skeleton} /> : (
          <>
            {Boolean(readDate) && lang('PmReadAt', formatDateAtTime(lang, readDate * 1000))}
            {!readDate && shouldRenderShowWhen && (
              <div>
                {lang('PmRead')}
                <span className={styles.get} onClick={handleOpenModal}>
                  {lang('PmReadShowWhen')}
                </span>
              </div>
            )}
          </>
        )}
      </Transition>
    </MenuItem>
  );
}

export default memo(ReadTimeMenuItem);
