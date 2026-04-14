import { memo, useEffect, useMemo, useRef, useState } from '@teact';

import type {
  ApiLocation,
  ApiPeer,
  ApiPollAnswer,
  ApiPollResult,
} from '../../../../api/types';
import type { ObserveFn } from '../../../../hooks/useIntersectionObserver';

import buildClassName from '../../../../util/buildClassName';
import { formatPercent } from '../../../../util/textFormat';
import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';

import useInterval from '../../../../hooks/schedulers/useInterval';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import AnimatedCounter from '../../../common/AnimatedCounter';
import AvatarList from '../../../common/AvatarList';
import CompactMapPreview from '../../../common/CompactMapPreview';
import CompactMediaPreview from '../../../common/CompactMediaPreview';
import Icon from '../../../common/icons/Icon';
import StickerView from '../../../common/StickerView';
import Spinner from '../../../ui/Spinner';
import Transition from '../../../ui/Transition';
import Checkbox from '@gili/primitives/Checkbox';
import Radio from '@gili/primitives/Radio';

import styles from './PollOption.module.scss';

type OwnProps = {
  answer: ApiPollAnswer;
  result?: ApiPollResult;
  isSelected?: boolean;
  isQuiz?: boolean;
  totalVotersCount?: number;
  isMultipleChoice?: boolean;
  hasResults?: boolean;
  hasMaskedResults?: boolean;
  isSendingVote?: boolean;
  recentVoters?: ApiPeer[];
  shouldReserveMediaColumn?: boolean;
  mediaPreviewId?: string;
  mediaPreviewIndex?: number;
  isInScheduled?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onSelect: (option: string) => void;
  onOpenMedia: (previewIndex: number) => void;
  onOpenLocation: (location: ApiLocation) => void;
};

const OPTION_MEDIA_SIZE = 48;
const MIN_PROGRESS = 5;
const PERCENT_STEP = 13;
const PERCENT_STEP_MS = 60;

const PollOption = ({
  answer,
  result,
  isSelected,
  isQuiz,
  totalVotersCount,
  isMultipleChoice,
  hasResults,
  hasMaskedResults,
  isSendingVote,
  recentVoters,
  shouldReserveMediaColumn,
  mediaPreviewId,
  mediaPreviewIndex,
  isInScheduled,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  onSelect,
  onOpenMedia,
  onOpenLocation,
}: OwnProps) => {
  const lang = useLang();
  const stickerRef = useRef<HTMLDivElement>();

  const media = answer.media;
  const shouldReserveMediaEndColumn = Boolean(shouldReserveMediaColumn);
  const votersCount = result?.votersCount ?? 0;

  const percentage = totalVotersCount
    ? Math.round((votersCount / totalVotersCount) * 100)
    : 0;
  const hasInitializedRef = useRef(false);
  const previousResultStateRef = useRef({
    percentage,
    votersCount,
    totalVotersCount,
  });
  const [displayedPercentage, setDisplayedPercentage] = useState(percentage);
  const [progressAnimationKey, setProgressAnimationKey] = useState(0);
  const isAnimatingPercentage = hasResults && !isSendingVote && displayedPercentage !== percentage;
  const progressPercentage = totalVotersCount !== undefined
    ? Math.max(MIN_PROGRESS, percentage) : 0;
  const selectorStateKey = isSendingVote ? 0
    : hasResults && !hasMaskedResults ? 1
      : hasMaskedResults ? 2 : 3;

  const answerText = useMemo(() => renderTextWithEntities({
    text: answer.text.text,
    entities: answer.text.entities,
  }), [answer.text.entities, answer.text.text]);

  useEffect(() => {
    const previousResultState = previousResultStateRef.current;
    previousResultStateRef.current = {
      percentage,
      votersCount,
      totalVotersCount,
    };

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setProgressAnimationKey((current) => current + 1);
      return;
    }

    if (!hasResults) {
      setDisplayedPercentage(percentage);
      return;
    }

    if (
      votersCount !== previousResultState.votersCount
      || totalVotersCount !== previousResultState.totalVotersCount
    ) {
      setDisplayedPercentage(isSendingVote ? 0
        : percentage !== previousResultState.percentage ? previousResultState.percentage : 0,
      );
      setProgressAnimationKey((current) => current + 1);
    }
  }, [hasResults, isSendingVote, percentage, totalVotersCount, votersCount]);

  useInterval(() => {
    setDisplayedPercentage((current) => {
      if (current === percentage) {
        return current;
      }

      if (current < percentage) {
        return Math.min(percentage, current + PERCENT_STEP);
      }

      return Math.max(percentage, current - PERCENT_STEP);
    });
  }, isAnimatingPercentage ? PERCENT_STEP_MS : undefined, true);

  const handleClick = useLastCallback(() => {
    onSelect(answer.option);
  });

  const handleOpenPreview = useLastCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (mediaPreviewIndex === undefined) {
      return;
    }

    e.stopPropagation();
    onOpenMedia(mediaPreviewIndex);
  });

  const handleOpenMap = useLastCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!media?.location) {
      return;
    }

    e.stopPropagation();
    onOpenLocation(media.location);
  });

  function renderSelector() {
    if (isSendingVote) {
      return <Spinner className={styles.spinner} color="gray" />;
    }

    if (hasResults && !hasMaskedResults) {
      return (
        <AnimatedCounter
          className={buildClassName(styles.percentage, percentage === 100 && styles.fullPercent)}
          text={formatPercent(displayedPercentage, 0)}
        />
      );
    }

    if (isMultipleChoice) {
      return (
        <Checkbox
          className={styles.input}
          checked={hasMaskedResults ? result?.isChosen : isSelected}
          disabled={hasMaskedResults || isInScheduled}
        />
      );
    }

    return (
      <Radio
        className={styles.input}
        value={answer.option}
        checked={hasMaskedResults ? result?.isChosen : isSelected}
        disabled={hasMaskedResults || isInScheduled}
      />
    );
  }

  function renderChosenMarker() {
    if (!hasResults || !result) {
      return undefined;
    }

    if (hasMaskedResults) {
      if (!result.isChosen) return undefined;
    } else if (!result.isChosen) {
      if (!isQuiz || !result.isCorrect) return undefined;
    }

    return (
      <div className={buildClassName(styles.chosenMarkerIcon, isMultipleChoice && styles.square)}>
        <Icon name={!hasMaskedResults && isQuiz && !result.isCorrect ? 'close' : 'check'} />
      </div>
    );
  }

  function renderResultsMeta() {
    if (!hasResults || hasMaskedResults || votersCount === 0) {
      return undefined;
    }

    return (
      <div className={styles.sideMeta}>
        <span className={styles.votersCount}>{lang.number(votersCount)}</span>
        {Boolean(recentVoters?.length) && (
          <AvatarList
            size="micro"
            peers={recentVoters}
            className={styles.avatarList}
            limit={2}
          />
        )}
      </div>
    );
  }

  function renderMedia() {
    if (media?.photo) {
      return (
        <CompactMediaPreview
          media={media}
          id={mediaPreviewId}
          className={styles.mediaPreview}
          size={OPTION_MEDIA_SIZE}
          observeIntersectionForLoading={observeIntersectionForLoading}
          observeIntersectionForPlaying={observeIntersectionForPlaying}
          onClick={handleOpenPreview}
        />
      );
    }

    if (media?.video) {
      return (
        <CompactMediaPreview
          media={media}
          id={mediaPreviewId}
          className={styles.mediaPreview}
          size={OPTION_MEDIA_SIZE}
          observeIntersectionForLoading={observeIntersectionForLoading}
          observeIntersectionForPlaying={observeIntersectionForPlaying}
          onClick={handleOpenPreview}
        />
      );
    }

    if (media?.location) {
      return (
        <CompactMapPreview
          className={styles.mediaPreview}
          geo={media.location.geo}
          width={OPTION_MEDIA_SIZE}
          height={OPTION_MEDIA_SIZE}
          shouldShowPin={false}
          onClick={handleOpenMap}
        />
      );
    }

    if (media?.sticker) {
      return (
        <div className={styles.stickerPreview} ref={stickerRef} onClick={(e) => e.stopPropagation()}>
          <StickerView
            containerRef={stickerRef}
            sticker={media.sticker}
            size={OPTION_MEDIA_SIZE}
            shouldLoop
            observeIntersectionForLoading={observeIntersectionForLoading}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
          />
        </div>
      );
    }

    return undefined;
  }

  const mediaNode = renderMedia();

  return (
    <div
      className={buildClassName(
        styles.root,
        hasResults && !hasMaskedResults && styles.hasResults,
        shouldReserveMediaEndColumn && styles.hasMediaColumn,
        hasResults && !hasMaskedResults && isQuiz && !result?.isCorrect && styles.incorrect,
      )}
      onClick={handleClick}
    >
      <Transition
        name="fade"
        activeKey={selectorStateKey}
        className={styles.selector}
        slideClassName={styles.selectorSlide}
        shouldCleanup
        direction={1}
      >
        {renderSelector()}
      </Transition>
      <div className={styles.answer} dir="auto">
        {answerText}
      </div>
      {renderResultsMeta()}
      {mediaNode && (
        <div className={styles.media}>
          {mediaNode}
        </div>
      )}
      <div className={styles.chosenMarker}>
        {renderChosenMarker()}
      </div>
      <div className={styles.progress}>
        <div
          className={styles.progressTrack}
          style={`--_progress: ${hasResults && !hasMaskedResults ? progressPercentage / 100 : 0}`}
        >
          <div
            className={buildClassName(styles.progressFill, progressAnimationKey > 0 && styles.animated)}
          />
        </div>
      </div>
    </div>
  );
};

export default memo(PollOption);
