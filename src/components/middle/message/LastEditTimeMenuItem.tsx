import React, { memo } from '../../../lib/teact/teact';

import type { ApiMessage } from '../../../api/types';

import { formatDateAtTime } from '../../../util/dates/dateFormat';

import useOldLang from '../../../hooks/useOldLang';

import MenuItem from '../../ui/MenuItem';
import Skeleton from '../../ui/placeholder/Skeleton';

import styles from './TimeMenuItem.module.scss';

type OwnProps = {
  message: ApiMessage;
};

function LastEditTimeMenuItem({
  message,
}: OwnProps) {
  const lang = useOldLang();
  const { editDate } = message;
  const shouldRenderSkeleton = !editDate;

  return (
    <MenuItem icon="clock-edit" className={styles.item}>
      {shouldRenderSkeleton ? <Skeleton className={styles.skeleton} /> : Boolean(editDate)
        && lang('Chat.PrivateMessageEditTimestamp.Date', formatDateAtTime(lang, editDate * 1000))}
    </MenuItem>
  );
}

export default memo(LastEditTimeMenuItem);
