import { memo } from '../../../lib/teact/teact';

import type { ApiMessage } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { formatEditDelay, getEditDelay, isLateEdit } from '../../../util/editRadar';
import { formatCalendarDate, secondsToDate } from '../../../util/localization/dateFormat';

import useLang from '../../../hooks/useLang';

import MenuItem from '../../ui/MenuItem';
import Skeleton from '../../ui/placeholder/Skeleton';

import styles from './TimeMenuItem.module.scss';

type OwnProps = {
  message: ApiMessage;
};

function LastEditTimeMenuItem({
  message,
}: OwnProps) {
  const lang = useLang();
  const { editDate } = message;
  const shouldRenderSkeleton = !editDate;

  const isLate = !shouldRenderSkeleton && isLateEdit(message);

  return (
    <>
      <MenuItem icon="clock-edit" className={styles.item}>
        {shouldRenderSkeleton ? <Skeleton className={styles.skeleton} animation="wave" /> : Boolean(editDate)
          && lang('ChatPrivateMessageEditTimestampDate', {
            date: formatCalendarDate(lang, secondsToDate(editDate), { variant: 'date', isShort: true, withTime: true }),
          })}
      </MenuItem>
      {isLate && (
        <MenuItem icon="clock" className={buildClassName(styles.item, styles.lateEdit)}>
          {lang('EditRadarSentDate', {
            date: formatCalendarDate(lang, secondsToDate(message.date), { variant: 'date', isShort: true }),
          })}
          {' · '}
          {lang('EditRadarEditedLater', { delay: formatEditDelay(lang, getEditDelay(message)!) })}
        </MenuItem>
      )}
    </>
  );
}

export default memo(LastEditTimeMenuItem);
