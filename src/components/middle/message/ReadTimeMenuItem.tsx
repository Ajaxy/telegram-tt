import { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessage } from '../../../api/types';

import { formatCalendarDate, secondsToDate } from '../../../util/localization/dateFormat';

import useLang from '../../../hooks/useLang';

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
  const lang = useLang();
  const { readDate } = message;
  const shouldRenderSkeleton = canLoadReadDate && !readDate && !shouldRenderShowWhen;

  const handleOpenModal = () => {
    closeContextMenu();
    openPrivacySettingsNoticeModal({ chatId: message.chatId, isReadDate: true });
  };

  return (
    <MenuItem icon="message-read" className={styles.item}>
      <Transition name="fade" activeKey={shouldRenderSkeleton ? 1 : 2} className={styles.transition}>
        {shouldRenderSkeleton ? <Skeleton className={styles.skeleton} animation="wave" /> : (
          <>
            {Boolean(readDate) && lang('MessageReadAt', {
              date: formatCalendarDate(lang, secondsToDate(readDate), {
                variant: 'date', isShort: true, withTime: true,
              }),
            })}
            {!readDate && shouldRenderShowWhen && (
              <div>
                {lang('FilterRead')}
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
