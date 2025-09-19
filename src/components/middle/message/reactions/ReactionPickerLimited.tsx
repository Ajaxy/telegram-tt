import type { FC } from '../../../../lib/teact/teact';
import {
  memo,
  useMemo, useRef,
} from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type {
  ApiAvailableReaction, ApiChatReactions, ApiMessage,
  ApiReaction,
  ApiReactionWithPaid,
} from '../../../../api/types';

import {
  getReactionKey, sortReactions,
} from '../../../../global/helpers';
import { selectChatFullInfo } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { REM } from '../../../common/helpers/mediaDimensions';

import useAppLayout from '../../../../hooks/useAppLayout';
import useWindowSize from '../../../../hooks/window/useWindowSize';

import ReactionEmoji from '../../../common/reactions/ReactionEmoji';

import styles from './ReactionPickerLimited.module.scss';

type OwnProps = {
  chatId: string;
  loadAndPlay: boolean;
  selectedReactionIds?: string[];
  message?: ApiMessage;
  onReactionSelect: (reaction: ApiReactionWithPaid) => void;
  onReactionContext?: (reaction: ApiReactionWithPaid) => void;
};

type StateProps = {
  enabledReactions?: ApiChatReactions;
  availableReactions?: ApiAvailableReaction[];
  topReactions: ApiReaction[];
  isWithPaidReaction?: boolean;
  reactionsLimit?: number;
};

const REACTION_SIZE = 36;
const GRID_GAP_THRESHOLD = 600;
const MODAL_PADDING_SIZE_REM = 0.5;
const MODAL_MAX_HEIGHT_REM = 18;
const MODAL_MAX_WIDTH_REM = 26.25;
const GRID_GAP_DESKTOP_REM = 0.625;
const GRID_GAP_MOBILE_REM = 0.5;

const ReactionPickerLimited: FC<OwnProps & StateProps> = ({
  loadAndPlay,
  enabledReactions,
  availableReactions,
  topReactions,
  selectedReactionIds,
  isWithPaidReaction,
  message,
  reactionsLimit,
  onReactionSelect,
  onReactionContext,
}) => {
  const sharedCanvasRef = useRef<HTMLCanvasElement>();
  const sharedCanvasHqRef = useRef<HTMLCanvasElement>();
  const { width: windowWidth } = useWindowSize();
  const { isTouchScreen } = useAppLayout();

  const currentReactions = message?.reactions?.results;

  const shouldUseCurrentReactions = reactionsLimit && currentReactions
    && currentReactions.length >= reactionsLimit;

  const allAvailableReactions = useMemo(() => {
    if (shouldUseCurrentReactions) {
      const reactions = currentReactions.map(({ reaction }) => reaction);
      if (isWithPaidReaction) {
        reactions.unshift({ type: 'paid' });
      }
      return reactions;
    }

    if (!enabledReactions) {
      return [];
    }

    if (enabledReactions.type === 'all') {
      const reactionsToSort: ApiReactionWithPaid[] = (availableReactions || []).map(({ reaction }) => reaction);
      if (isWithPaidReaction) {
        reactionsToSort.unshift({ type: 'paid' });
      }
      return sortReactions(reactionsToSort, topReactions);
    }

    const reactionsToSort: ApiReactionWithPaid[] = enabledReactions.allowed.slice();
    if (isWithPaidReaction) {
      reactionsToSort.unshift({ type: 'paid' });
    }

    return sortReactions(reactionsToSort, topReactions);
  }, [
    availableReactions, enabledReactions, topReactions, shouldUseCurrentReactions, currentReactions, isWithPaidReaction,
  ]);

  const pickerHeight = useMemo(() => {
    const pickerWidth = Math.min(MODAL_MAX_WIDTH_REM * REM, windowWidth);
    const gapWidth = (windowWidth > GRID_GAP_THRESHOLD ? GRID_GAP_DESKTOP_REM : GRID_GAP_MOBILE_REM) * REM;
    const availableWidth = pickerWidth - MODAL_PADDING_SIZE_REM * REM;

    const itemsInRow = Math.floor((availableWidth + gapWidth) / (REACTION_SIZE + gapWidth));
    const rowsCount = Math.ceil(allAvailableReactions.length / itemsInRow);

    const pickerMaxHeight = rowsCount * REACTION_SIZE + (rowsCount - 1) * gapWidth + MODAL_PADDING_SIZE_REM * REM * 2;

    return Math.min(MODAL_MAX_HEIGHT_REM * REM, pickerMaxHeight);
  }, [allAvailableReactions.length, windowWidth]);

  return (
    <div className={styles.root} style={`height: ${pickerHeight}px`}>
      <div className={buildClassName(styles.wrapper, isTouchScreen ? 'no-scrollbar' : 'custom-scroll')}>
        <div className="symbol-set-container shared-canvas-container">
          <canvas ref={sharedCanvasRef} className="shared-canvas" />
          <canvas ref={sharedCanvasHqRef} className="shared-canvas" />
          {allAvailableReactions.map((reaction) => {
            const reactionId = getReactionKey(reaction);
            const isSelected = reactionId ? selectedReactionIds?.includes(reactionId) : undefined;

            return (
              <ReactionEmoji
                key={reactionId}
                reaction={reaction}
                isSelected={isSelected}
                loadAndPlay={loadAndPlay}
                availableReactions={availableReactions}
                onClick={onReactionSelect}
                onContextMenu={onReactionContext}
                sharedCanvasRef={sharedCanvasRef}
                sharedCanvasHqRef={sharedCanvasHqRef}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): Complete<StateProps> => {
    const { availableReactions, topReactions } = global.reactions;

    const { maxUniqueReactions } = global.appConfig;
    const { enabledReactions, isPaidReactionAvailable } = selectChatFullInfo(global, chatId) || {};

    return {
      enabledReactions,
      availableReactions,
      topReactions,
      reactionsLimit: maxUniqueReactions,
      isWithPaidReaction: isPaidReactionAvailable,
    };
  },
)(ReactionPickerLimited));
