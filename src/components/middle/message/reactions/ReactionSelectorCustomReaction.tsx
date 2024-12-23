import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useEffect, useRef } from '../../../../lib/teact/teact';

import type { ApiReaction, ApiReactionCustomEmoji, ApiReactionPaid } from '../../../../api/types';

import buildClassName from '../../../../util/buildClassName';
import { LOCAL_TGS_URLS } from '../../../common/helpers/animatedAssets';
import { REM } from '../../../common/helpers/mediaDimensions';

import useContextMenuHandlers from '../../../../hooks/useContextMenuHandlers';
import useLastCallback from '../../../../hooks/useLastCallback';

import AnimatedIcon from '../../../common/AnimatedIcon';
import CustomEmoji from '../../../common/CustomEmoji';
import Icon from '../../../common/icons/Icon';

import styles from './ReactionSelectorReaction.module.scss';

const REACTION_SIZE = 2 * REM;

type OwnProps = {
  reaction: ApiReactionCustomEmoji | ApiReactionPaid;
  chosen?: boolean;
  isReady?: boolean;
  noAppearAnimation?: boolean;
  style?: string;
  isLocked?: boolean;
  onToggleReaction: (reaction: ApiReaction) => void;
  onSendPaidReaction?: NoneToVoidFunction;
  onShowPaidReactionModal?: NoneToVoidFunction;
};

const ReactionSelectorCustomReaction: FC<OwnProps> = ({
  reaction,
  chosen,
  isReady,
  noAppearAnimation,
  style,
  isLocked,
  onToggleReaction,
  onSendPaidReaction,
  onShowPaidReactionModal,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const handleClick = useLastCallback(() => {
    if (reaction.type === 'paid') {
      onSendPaidReaction?.();
      return;
    }

    onToggleReaction(reaction);
  });

  const {
    isContextMenuOpen,
    handleBeforeContextMenu,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(ref, reaction.type !== 'paid', undefined, undefined, undefined, true);

  useEffect(() => {
    if (isContextMenuOpen) {
      onShowPaidReactionModal?.();

      handleContextMenuClose();
      handleContextMenuHide();
    }
  }, [handleContextMenuClose, onShowPaidReactionModal, handleContextMenuHide, isContextMenuOpen]);

  return (
    <div
      className={buildClassName(
        styles.root,
        styles.custom,
        chosen && reaction.type !== 'paid' && styles.chosen,
        !noAppearAnimation && isReady && styles.customAnimated,
        noAppearAnimation && styles.visible,
      )}
      ref={ref}
      style={style}
      onClick={handleClick}
      onMouseDown={handleBeforeContextMenu}
      onContextMenu={handleContextMenu}
    >
      {reaction.type === 'paid' ? (
        <AnimatedIcon
          tgsUrl={LOCAL_TGS_URLS.StarReaction}
          size={REACTION_SIZE}
          noLoop={false}
        />
      ) : (
        <CustomEmoji
          documentId={reaction.documentId}
          size={REACTION_SIZE}
        />
      )}
      {isLocked && (
        <Icon className={styles.lock} name="lock-badge" />
      )}
    </div>
  );
};

export default memo(ReactionSelectorCustomReaction);
