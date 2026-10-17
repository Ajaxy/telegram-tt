import { memo, useEffect, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiUser } from '../../api/types';
import type { Wish } from '../../types/wish';

import { selectWish } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import AvatarList from '../common/AvatarList';
import Icon from '../common/icons/Icon';
import ListItem from '../ui/ListItem';

import styles from './WishRow.module.scss';

type OwnProps = {
  ownerId: string;
};

type StateProps = {
  wish?: Wish;
  isOwner: boolean;
  usersById: Record<string, ApiUser>;
};

const FACEPILE_AVATAR_SIZE = 22;
const FACEPILE_LIMIT = 3;

const WishRow = ({
  ownerId,
  wish,
  isOwner,
  usersById,
}: OwnProps & StateProps) => {
  const { loadWish } = getActions();
  const lang = useLang();

  useEffect(() => {
    loadWish({ ownerId });
  }, [ownerId]);

  const recentSupporters = useMemo(() => {
    if (!wish) return undefined;

    return [...wish.supporters]
      .sort((a, b) => b.lastSupportAt - a.lastSupportAt)
      .slice(0, FACEPILE_LIMIT)
      .map(({ userId }) => usersById[userId])
      .filter(Boolean);
  }, [wish, usersById]);

  if (!wish) return undefined;

  const { title, targetGram, raisedGram, settings, supporters } = wish;
  if (!isOwner && !settings.shouldShowWish) return undefined;

  const isDimmed = isOwner && !settings.shouldShowWish;
  const shouldShowFacepile = isOwner || settings.shouldShowSupporters;

  return (
    <>
      <ListItem
        icon="gram-filled"
        iconBg="blue"
        className={buildClassName(styles.root, isDimmed && styles.dimmed)}
        multiline
        narrow
        ripple
      >
        <span className="title" dir="auto">{title}</span>
        <span className={styles.amount}>
          {lang('WishAmount', {
            raised: <span className={styles.raised}>{lang.number(raisedGram)}</span>,
            target: lang.number(targetGram),
          }, { withNodes: true })}
        </span>
        <span className={styles.supporters}>
          {shouldShowFacepile && Boolean(recentSupporters?.length) && (
            <AvatarList size={FACEPILE_AVATAR_SIZE} peers={recentSupporters} limit={FACEPILE_LIMIT} />
          )}
          {lang('WishSupporters', { count: supporters.length }, { pluralValue: supporters.length })}
          <Icon name="next" className={styles.chevron} />
        </span>
        <span className="subtitle">{lang('WishLabel')}</span>
      </ListItem>
      <ListItem
        icon={isOwner ? 'edit' : 'gram'}
        className={isDimmed ? styles.dimmed : undefined}
        withPrimaryColor
        narrow
        ripple
      >
        <span>{lang(isOwner ? 'WishManage' : 'WishSupport')}</span>
      </ListItem>
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { ownerId }): Complete<StateProps> => {
    return {
      wish: selectWish(global, ownerId),
      isOwner: ownerId === global.currentUserId,
      usersById: global.users.byId,
    };
  },
)(WishRow));
