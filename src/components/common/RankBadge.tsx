import { memo } from '@teact';
import { getActions } from '../../global';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import { getPeerColorClass } from '../../hooks/usePeerColor';

import BadgeButton from './BadgeButton';

type OwnProps = {
  chatId: string;
  userId: string;
  isAdmin?: boolean;
  isOwner?: boolean;
  className?: string;
  rank?: string;
  isClickable?: boolean;
};

const OWNER_PEER_COLOR = 2;
const ADMIN_PEER_COLOR = 3;

const RankBadge = ({
  chatId, className, userId, isAdmin, isOwner, rank, isClickable,
}: OwnProps) => {
  const { openRankModal } = getActions();
  const lang = useLang();
  const hasCustomColor = isOwner || isAdmin;
  const isPlain = !hasCustomColor;

  const rankText = rank || (isOwner && lang('ChannelCreator')) || (isAdmin && lang('ChannelAdmin'));

  const handleClick = useLastCallback(() => {
    if (!chatId) return;
    openRankModal({ chatId, userId, isAdmin, isOwner, rank });
  });

  if (!rankText) {
    return undefined;
  }

  return (
    <BadgeButton
      className={buildClassName(
        hasCustomColor && getPeerColorClass(isOwner ? OWNER_PEER_COLOR : ADMIN_PEER_COLOR),
        isPlain && 'admin-title-plain',
        className,
      )}
      isPlain={isPlain}
      inline
      onClick={isClickable ? handleClick : undefined}
    >
      {rankText}
    </BadgeButton>
  );
};

export default memo(RankBadge);
