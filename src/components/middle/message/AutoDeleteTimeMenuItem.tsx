import { memo } from '../../../lib/teact/teact';

import { getServerTime } from '../../../util/serverTime';

import useForceUpdate from '../../../hooks/useForceUpdate';
import useLang from '../../../hooks/useLang';

import MenuItem from '../../ui/MenuItem';
import TextTimer from '../../ui/TextTimer';

import styles from './TimeMenuItem.module.scss';

type OwnProps = {
  endsAt: number;
};

function AutoDeleteTimeMenuItem({ endsAt }: OwnProps) {
  const forceUpdate = useForceUpdate();
  const lang = useLang();

  if (endsAt <= getServerTime()) return undefined;

  return (
    <MenuItem icon="timer" className={styles.item}>
      {lang('AutoDeleteIn', {
        time: <TextTimer className={styles.timer} endsAt={endsAt} mode="rounded" onEnd={forceUpdate} />,
      }, { withNodes: true })}
    </MenuItem>
  );
}

export default memo(AutoDeleteTimeMenuItem);
