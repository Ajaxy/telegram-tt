import { memo } from '../../../lib/teact/teact';

import type { ApiMessage } from '../../../api/types';

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

  return (
    <MenuItem icon="clock-edit" className={styles.item}>
      {shouldRenderSkeleton ? <Skeleton className={styles.skeleton} animation="wave" /> : Boolean(editDate)
        && lang('ChatPrivateMessageEditTimestampDate', {
          date: formatCalendarDate(lang, secondsToDate(editDate), { variant: 'date', isShort: true, withTime: true }),
        })}
    </MenuItem>
  );
}

export default memo(LastEditTimeMenuItem);
