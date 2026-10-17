import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiUser } from '../../api/types';
import type { TabState } from '../../global/types';
import type { Wish } from '../../types/wish';

import { selectTabState, selectWish } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { roundGram } from '../../api/wish/mockWishApi';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import AvatarList from '../common/AvatarList';
import Icon from '../common/icons/Icon';
import ListItem from '../ui/ListItem';
import WishCrystal from './WishCrystal';
import WishParticles from './WishParticles';

import styles from './WishRow.module.scss';

type OwnProps = {
  ownerId: string;
};

type StateProps = {
  wish?: Wish;
  isOwner: boolean;
  usersById: Record<string, ApiUser>;
  burst?: TabState['wishBurst'];
};

const FACEPILE_AVATAR_SIZE = 22;
const FACEPILE_LIMIT = 3;
const IS_REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const WishRow = ({
  ownerId,
  wish,
  isOwner,
  usersById,
  burst,
}: OwnProps & StateProps) => {
  const {
    loadWish, openWishModal, openWishSendModal, supportWish, finishWishBurst,
  } = getActions();
  const lang = useLang();

  const crystalRef = useRef<HTMLDivElement>();
  // The transferred amount until the first particle lands and applies it
  const pendingSupportGramRef = useRef(0);
  const [burstBaseline, setBurstBaseline] = useState<{ id: number; raisedGram: number }>();
  const [arrivedGram, setArrivedGram] = useState(0);
  const [flashCount, setFlashCount] = useState(0);

  const activeBurst = burst?.ownerId === ownerId ? burst : undefined;

  useEffect(() => {
    loadWish({ ownerId });
  }, [ownerId]);

  // The raised amount grows with each arriving particle, counted from the amount before the transfer
  useEffect(() => {
    if (!activeBurst || !wish) return undefined;

    const { id, amountGram } = activeBurst;
    if (IS_REDUCED_MOTION) {
      supportWish({ ownerId, amountGram });
      finishWishBurst();
      return undefined;
    }

    pendingSupportGramRef.current = amountGram;
    setArrivedGram(0);
    setBurstBaseline({ id, raisedGram: wish.raisedGram });

    // Leaving the profile mid-flight still delivers the support and clears the burst
    return () => {
      applyPendingSupport();
      if (selectTabState(getGlobal()).wishBurst?.id === id) finishWishBurst();
    };
    // Only a new burst starts the count over
  }, [activeBurst?.id]); // eslint-disable-line react-hooks-static-deps/exhaustive-deps

  function applyPendingSupport() {
    if (!pendingSupportGramRef.current) return;

    supportWish({ ownerId, amountGram: pendingSupportGramRef.current });
    pendingSupportGramRef.current = 0;
  }

  const handleOpenDetails = useLastCallback(() => {
    openWishModal({ ownerId });
  });

  const handleAction = useLastCallback(() => {
    if (isOwner) {
      openWishModal({ ownerId });
    } else {
      openWishSendModal({ ownerId });
    }
  });

  const handleParticleArrive = useLastCallback((valueGram: number, isFirst: boolean) => {
    // The sender joins the supporters list as the first particle lands
    if (isFirst) applyPendingSupport();
    setArrivedGram((prev) => prev + valueGram);
    setFlashCount((prev) => prev + 1);
  });

  const handleParticlesEnd = useLastCallback(() => {
    finishWishBurst();
    setBurstBaseline(undefined);
    setArrivedGram(0);
  });

  const recentSupporters = useMemo(() => {
    if (!wish) return undefined;

    return [...wish.supporters]
      .sort((a, b) => b.lastSupportAt - a.lastSupportAt)
      .slice(0, FACEPILE_LIMIT)
      .map(({ userId }) => usersById[userId])
      .filter(Boolean);
  }, [wish, usersById]);

  if (!wish) return undefined;

  const { title, targetGram, settings, supporters } = wish;
  if (!isOwner && !settings.shouldShowWish) return undefined;

  const isBurstCounting = activeBurst && burstBaseline?.id === activeBurst.id;
  const raisedGram = isBurstCounting ? roundGram(burstBaseline.raisedGram + arrivedGram) : wish.raisedGram;
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
        onClick={handleOpenDetails}
        rightElement={(
          <WishCrystal
            ref={crystalRef}
            progress={raisedGram / targetGram}
            isComplete={raisedGram >= targetGram}
            flashCount={flashCount}
            className={styles.crystal}
          />
        )}
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
          <span className={styles.supportersCount}>
            {lang('WishSupporters', { count: supporters.length }, { pluralValue: supporters.length })}
          </span>
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
        onClick={handleAction}
      >
        <span>{lang(isOwner ? 'WishManage' : 'WishSupport')}</span>
      </ListItem>
      {isBurstCounting && (
        <WishParticles
          burstId={activeBurst.id}
          amountGram={activeBurst.amountGram}
          targetRef={crystalRef}
          onArrive={handleParticleArrive}
          onEnd={handleParticlesEnd}
        />
      )}
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { ownerId }): Complete<StateProps> => {
    return {
      wish: selectWish(global, ownerId),
      isOwner: ownerId === global.currentUserId,
      usersById: global.users.byId,
      burst: selectTabState(global).wishBurst,
    };
  },
)(WishRow));
