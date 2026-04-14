import {
  memo,
  type TeactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from '../../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../../global';

import type {
  ApiFormattedText,
  ApiLocation,
  ApiMessagePoll,
  ApiPoll,
  ApiSticker,
  MediaContent,
} from '../../../../api/types';
import type { ObserveFn } from '../../../../hooks/useIntersectionObserver';
import { type MediaViewerMedia, MediaViewerOrigin, type ThemeKey } from '../../../../types';

import { getMessageHtmlId } from '../../../../global/helpers';
import { selectPeer } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { buildCollectionByKey, shuffle } from '../../../../util/iteratees';
import { NEXT_ARROW_REPLACEMENT, PREVIOUS_ARROW_REPLACEMENT } from '../../../../util/localization/format';
import { getServerTime } from '../../../../util/serverTime';
import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';

import useTimeout from '../../../../hooks/schedulers/useTimeout';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import AvatarList from '../../../common/AvatarList';
import CompactMapPreview from '../../../common/CompactMapPreview';
import Document from '../../../common/Document';
import PeerColorWrapper from '../../../common/PeerColorWrapper';
import StickerView from '../../../common/StickerView';
import Button from '../../../ui/Button';
import TextTimer from '../../../ui/TextTimer';
import Transition from '../../../ui/Transition';
import Photo from '../Photo';
import Video from '../Video';
import PollOption from './PollOption';

import styles from './Poll.module.scss';

type OwnProps = {
  chatId: string;
  messageId: number;
  poll: ApiMessagePoll;
  messageText?: ApiFormattedText;
  theme: ThemeKey;
  isInScheduled?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
};

const ATTACHED_MAP_WIDTH = 350;
const ATTACHED_MAP_HEIGHT = 200;
const ATTACHED_MAP_ZOOM = 15;
const STICKER_PREVIEW_SIZE = 96;
const VOTE_TIMEOUT = 5000;

const Poll = ({
  chatId,
  messageId,
  poll,
  messageText,
  theme,
  isInScheduled,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
}: OwnProps) => {
  const {
    openMapModal,
    openMediaViewer,
    openPollResults,
    requestConfetti,
    sendPollVote,
    loadMessage,
  } = getActions();
  const lang = useLang();
  const serverTime = getServerTime();

  const { summary, results, attachedMedia } = poll;
  const { answers, question, isMultipleChoice } = summary;
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);
  const [isSendingVote, setIsSendingVote] = useState(false);
  const [isViewingAuthorResults, setIsViewingAuthorResults] = useState(false);
  const [answerOrder] = useState<string[]>(() => (
    buildAnswerOrder(answers, summary.shouldShuffleAnswers)
  ));

  const hasChosenAnswer = useMemo(
    () => Object.values(results.resultByOption || {}).some((result) => result.isChosen),
    [results.resultByOption],
  );
  const activeCloseDate = !summary.isClosed && summary.closeDate && summary.closeDate > serverTime
    ? summary.closeDate
    : undefined;
  const areResultsHiddenForCurrentUser = Boolean(
    summary.shouldHideResultsUntilClose && activeCloseDate && !summary.isCreator,
  );
  const hasMaskedResults = areResultsHiddenForCurrentUser && hasChosenAnswer;
  const canVote = !summary.isClosed && !hasChosenAnswer;
  const hasExplanation = summary.isQuiz && Boolean(results.solution?.trim() || results.solutionMedia);
  const hasOptionMedia = useMemo(
    () => answers.some((answer) => hasPollOptionMedia(answer)),
    [answers],
  );
  const selectedOptionsSet = useMemo(() => new Set(selectedOptions), [selectedOptions]);
  const hasResultData = Boolean(results.resultByOption);
  const totalVoters = results.totalVoters || 0;
  const canToggleAuthorResults = summary.isCreator && canVote && hasResultData && totalVoters > 0;
  const areInlineResultsVisible = hasResultData && (
    (!canVote && !areResultsHiddenForCurrentUser) || isViewingAuthorResults
  );
  const canShowResultsPanel = hasChosenAnswer && summary.isPublic && hasResultData && !areResultsHiddenForCurrentUser;

  useEffect(() => {
    if (!canVote) {
      setSelectedOptions([]);
      setIsSendingVote(false);
    }
  }, [canVote]);

  useTimeout(() => {
    setIsSendingVote(false);
  }, isSendingVote ? VOTE_TIMEOUT : undefined);

  useEffect(() => {
    if (!summary.isQuiz || !isSendingVote || areResultsHiddenForCurrentUser) {
      return;
    }

    const resultByOption = results.resultByOption;
    if (!resultByOption) {
      return;
    }

    const pollResults = Object.values(resultByOption);
    const chosenResults = pollResults.filter((result) => result.isChosen);
    const correctResults = pollResults.filter((result) => result.isCorrect);

    if (
      !chosenResults.length
      || chosenResults.length !== correctResults.length
      || !chosenResults.every((result) => result.isCorrect)
    ) {
      return;
    }

    requestConfetti({});
  }, [areResultsHiddenForCurrentUser, isSendingVote, results.resultByOption, summary.isQuiz]);

  useEffect(() => {
    if (!canToggleAuthorResults) {
      setIsViewingAuthorResults(false);
    }
  }, [canToggleAuthorResults]);

  useEffect(() => {
    if (!hasExplanation) {
      setIsExplanationOpen(false);
    }
  }, [hasExplanation]);

  const answersByOption = useMemo(() => buildCollectionByKey(answers, 'option'), [answers]);

  const orderedAnswers = useMemo(() => {
    const seen = new Set(answerOrder);
    const ordered = answerOrder
      .map((option) => answersByOption[option])
      .filter(Boolean);
    const appended = answers.filter((answer) => !seen.has(answer.option));

    return [...ordered, ...appended];
  }, [answerOrder, answers, answersByOption]);

  const previewItems = useMemo(() => {
    const items: {
      key: string;
      media: MediaViewerMedia;
    }[] = [];

    if (attachedMedia?.photo) {
      items.push({ key: 'attached', media: attachedMedia.photo });
    } else if (attachedMedia?.video) {
      items.push({ key: 'attached', media: attachedMedia.video });
    } else if (attachedMedia?.document) {
      items.push({ key: 'attached', media: attachedMedia.document });
    }

    if (results.solutionMedia?.photo) {
      items.push({ key: 'explanation', media: results.solutionMedia.photo });
    } else if (results.solutionMedia?.video) {
      items.push({ key: 'explanation', media: results.solutionMedia.video });
    } else if (results.solutionMedia?.document) {
      items.push({ key: 'explanation', media: results.solutionMedia.document });
    }

    orderedAnswers.forEach((answer) => {
      if (answer.media?.photo) {
        items.push({ key: answer.option, media: answer.media.photo });
      } else if (answer.media?.video) {
        items.push({ key: answer.option, media: answer.media.video });
      }
    });

    return items;
  }, [attachedMedia, orderedAnswers, results.solutionMedia]);

  const previewIndexByKey = useMemo(() => {
    return previewItems.reduce((acc, item, index) => {
      acc[item.key] = index;
      return acc;
    }, {} as Record<string, number>);
  }, [previewItems]);
  const standaloneMedia = useMemo(() => previewItems.map((item) => item.media), [previewItems]);

  const pollRecentVoters = useMemo(
    () => areResultsHiddenForCurrentUser ? undefined : resolvePeers(results.recentVoterIds),
    [areResultsHiddenForCurrentUser, results.recentVoterIds],
  );

  const submitVote = useLastCallback((options: string[]) => {
    setIsSendingVote(true);
    sendPollVote({
      chatId,
      messageId,
      options,
    });
  });

  const handleSelectOption = useLastCallback((option: string) => {
    if (!canVote || isSendingVote || isViewingAuthorResults) {
      return;
    }

    if (!isMultipleChoice) {
      submitVote([option]);
      return;
    }

    setSelectedOptions((current) => {
      if (current.includes(option)) {
        return current.filter((currentOption) => currentOption !== option);
      }

      return [...current, option];
    });
  });

  const handleSendVote = useLastCallback(() => {
    if (!canVote || !selectedOptions.length || isSendingVote) {
      return;
    }

    submitVote(selectedOptions);
  });

  const handleOpenPreview = useLastCallback((previewIndex: number) => {
    if (!standaloneMedia.length) {
      return;
    }

    openMediaViewer({
      chatId,
      messageId,
      mediaIndex: previewIndex,
      standaloneMedia,
      origin: MediaViewerOrigin.PollPreview,
    });
  });

  const handleOpenLocation = useLastCallback((location: ApiLocation) => {
    openMapModal({
      geoPoint: location.geo,
      zoom: ATTACHED_MAP_ZOOM,
    });
  });

  const handleOpenResults = useLastCallback(() => {
    if (!canShowResultsPanel) {
      return;
    }

    openPollResults({ chatId, messageId });
  });

  const handleToggleAuthorResults = useLastCallback(() => {
    if (!canToggleAuthorResults) {
      return;
    }

    setIsViewingAuthorResults((current) => !current);
  });

  const handleToggleExplanation = useLastCallback(() => {
    setIsExplanationOpen((current) => !current);
  });

  const handleCloseDateEnd = useLastCallback(() => {
    loadMessage({ chatId, messageId });
  });

  const attachedPreviewIndex = attachedMedia && previewIndexByKey.attached;
  const explanationPreviewIndex = results.solutionMedia && previewIndexByKey.explanation;
  const attachedMediaEl = attachedMedia && renderPollMedia({
    content: attachedMedia,
    theme,
    previewIndex: attachedPreviewIndex,
    previewId: attachedPreviewIndex !== undefined ? getPollPreviewId(messageId, attachedPreviewIndex) : undefined,
    observeIntersectionForLoading,
    observeIntersectionForPlaying,
    onOpenLocation: handleOpenLocation,
    onOpenPreview: handleOpenPreview,
  });
  const explanationMedia = results.solutionMedia && renderPollMedia({
    content: results.solutionMedia,
    theme,
    previewIndex: explanationPreviewIndex,
    previewId: explanationPreviewIndex !== undefined ? getPollPreviewId(messageId, explanationPreviewIndex) : undefined,
    isNestedMedia: true,
    observeIntersectionForLoading,
    observeIntersectionForPlaying,
    onOpenLocation: handleOpenLocation,
    onOpenPreview: handleOpenPreview,
    locationWidth: ATTACHED_MAP_WIDTH,
    locationHeight: ATTACHED_MAP_HEIGHT,
  });

  const questionText = useMemo(() => renderTextWithEntities({
    text: question.text,
    entities: question.entities,
  }), [question.entities, question.text]);
  const descriptionText = useMemo(() => messageText && renderTextWithEntities({
    text: messageText.text,
    entities: messageText.entities,
  }), [messageText]);
  const explanationText = useMemo(() => results.solution?.trim() ? renderTextWithEntities({
    text: results.solution,
    entities: results.solutionEntities,
  }) : undefined, [results.solution, results.solutionEntities]);
  const footerSubtext = activeCloseDate
    ? lang(areResultsHiddenForCurrentUser ? 'PollResultsTime' : 'PollEndsTime', {
      time: (
        <TextTimer
          endsAt={activeCloseDate}
          mode="countdown"
          shouldShowZeroOnEnd
          onEnd={handleCloseDateEnd}
        />
      ),
    }, { withNodes: true })
    : undefined;

  const footerContent = useMemo(() => {
    const renderFooterBody = (label: TeactNode) => (
      <div className={styles.footerContent}>
        <span>{label}</span>
        {Boolean(footerSubtext) && (
          <div
            className={styles.footerSubtext}
            dir="auto"
          >
            {footerSubtext}
          </div>
        )}
      </div>
    );

    if (canVote && isMultipleChoice && selectedOptions.length) {
      return (
        <Button
          className={styles.footerButton}
          disabled={isSendingVote}
          noForcedUpperCase
          isText
          inline
          size="smaller"
          color="adaptive"
          onClick={handleSendVote}
        >
          {renderFooterBody(lang(summary.isQuiz ? 'PollSubmitAnswers' : 'PollSubmitVotes'))}
        </Button>
      );
    }

    if (canToggleAuthorResults) {
      const label = isViewingAuthorResults
        ? lang(summary.isQuiz ? 'PollBackToAnswer' : 'PollBackToVote', undefined, {
          withNodes: true,
          specialReplacement: PREVIOUS_ARROW_REPLACEMENT,
        })
        : lang(
          summary.isQuiz ? 'PollAnswerCountButton' : 'PollVoteCountButton',
          { count: totalVoters },
          {
            withNodes: true,
            pluralValue: totalVoters,
            specialReplacement: NEXT_ARROW_REPLACEMENT,
          },
        );

      return (
        <Button
          className={styles.footerButton}
          noForcedUpperCase
          isText
          inline
          size="smaller"
          color="adaptive"
          onClick={handleToggleAuthorResults}
        >
          <Transition
            activeKey={Number(isViewingAuthorResults)}
            name={lang.isRtl ? 'slideRtl' : 'slide'}
            shouldCleanup
            slideClassName={styles.footerContentSlide}
          >
            {renderFooterBody(label)}
          </Transition>
        </Button>
      );
    }

    if (canVote && isMultipleChoice) {
      return (
        <Button
          className={styles.footerButton}
          disabled={isSendingVote || !selectedOptions.length}
          noForcedUpperCase
          isText
          inline
          size="smaller"
          color="adaptive"
          onClick={handleSendVote}
        >
          {renderFooterBody(lang(summary.isQuiz ? 'PollSubmitAnswers' : 'PollSubmitVotes'))}
        </Button>
      );
    }

    if (canShowResultsPanel) {
      return (
        <Button
          className={styles.footerButton}
          noForcedUpperCase
          isText
          inline
          size="smaller"
          color="adaptive"
          onClick={handleOpenResults}
        >
          {renderFooterBody(lang('PollViewResults'))}
        </Button>
      );
    }

    if (totalVoters) {
      return (
        <div className={styles.footerStatic}>
          {renderFooterBody(lang(summary.isQuiz ? 'PollAnsweredCount' : 'VoteCount', {
            count: totalVoters,
          }, { pluralValue: totalVoters }))}
        </div>
      );
    }

    return (
      <div className={styles.footerStatic}>
        {renderFooterBody(lang(summary.isQuiz ? 'ChatQuizTotalVotesEmpty' : 'ChatPollTotalVotesResultEmpty'))}
      </div>
    );
  }, [
    canShowResultsPanel,
    canToggleAuthorResults,
    canVote,
    isMultipleChoice,
    isSendingVote,
    isViewingAuthorResults,
    lang,
    selectedOptions.length,
    summary.isQuiz,
    footerSubtext,
    totalVoters,
  ]);

  return (
    <>
      {attachedMediaEl}
      <div className={styles.root} dir={lang.isRtl ? 'rtl' : undefined}>
        {isExplanationOpen && hasExplanation && (
          <PeerColorWrapper className={styles.explanation} shouldReset>
            <div className={styles.explanationHeader}>
              <span className={styles.explanationTitle}>
                {lang('PollsSolutionTitle')}
              </span>
              {explanationText && (
                <div className={styles.explanationText} dir="auto">
                  {explanationText}
                </div>
              )}
            </div>
            <Button
              round
              size="tiny"
              color="adaptive"
              isText
              iconName="close"
              ariaLabel={lang('Close')}
              onClick={handleToggleExplanation}
              className={styles.explanationCloseButton}
            />
            {explanationMedia && (
              <div className={styles.explanationMedia}>
                {explanationMedia}
              </div>
            )}
          </PeerColorWrapper>
        )}
        {descriptionText && (
          <div dir="auto">
            {descriptionText}
          </div>
        )}
        <div className={styles.questionContainer}>
          <div className={styles.question} dir="auto">
            {questionText}
          </div>
          {hasExplanation && !isExplanationOpen && (
            <div className={styles.explanationToggleButton}>
              <Button
                round
                size="smaller"
                color="adaptive"
                isText
                iconName="lamp"
                ariaLabel={lang('MediaPollSolutionAria')}
                onClick={handleToggleExplanation}
              />
            </div>
          )}
          <div className={styles.meta}>
            <div className={styles.metaInfo}>
              <span className={styles.metaLabel}>
                {summary.isClosed
                  ? lang('FinalResults')
                  : summary.isQuiz
                    ? lang(summary.isPublic ? 'QuizPoll' : 'AnonymousQuizPoll')
                    : lang(summary.isPublic ? 'PublicPoll' : 'AnonymousPoll')}
              </span>
              {Boolean(pollRecentVoters?.length) && (
                <AvatarList
                  size="micro"
                  peers={pollRecentVoters}
                  className={styles.metaVoters}
                />
              )}
            </div>
          </div>
        </div>
        <div className={styles.options}>
          {orderedAnswers.map((answer) => {
            const optionResult = results.resultByOption?.[answer.option];
            const previewIndex = previewIndexByKey[answer.option];

            return (
              <PollOption
                key={answer.option}
                answer={answer}
                result={optionResult}
                isQuiz={summary.isQuiz}
                totalVotersCount={results.totalVoters}
                hasResults={areInlineResultsVisible || hasMaskedResults}
                hasMaskedResults={hasMaskedResults}
                isSendingVote={isSendingVote}
                isInScheduled={isInScheduled}
                isSelected={selectedOptionsSet.has(answer.option)}
                isMultipleChoice={isMultipleChoice}
                recentVoters={hasMaskedResults ? undefined : resolvePeers(optionResult?.recentVoterIds)}
                shouldReserveMediaColumn={hasOptionMedia}
                mediaPreviewId={previewIndex !== undefined
                  ? getPollPreviewId(messageId, previewIndex)
                  : undefined}
                mediaPreviewIndex={previewIndex}
                observeIntersectionForLoading={observeIntersectionForLoading}
                observeIntersectionForPlaying={observeIntersectionForPlaying}
                onSelect={handleSelectOption}
                onOpenMedia={handleOpenPreview}
                onOpenLocation={handleOpenLocation}
              />
            );
          })}
        </div>
        {footerContent && (
          <div className={styles.footer}>
            {footerContent}
          </div>
        )}
      </div>
    </>
  );
};

function buildAnswerOrder(answers: ApiPoll['answers'], shouldShuffle?: true) {
  const options = answers.map((answer) => answer.option);
  return shouldShuffle ? shuffle(options) : options;
}

function resolvePeers(peerIds?: string[]) {
  if (!peerIds?.length) {
    return undefined;
  }

  const global = getGlobal();

  return peerIds
    .map((peerId) => selectPeer(global, peerId))
    .filter(Boolean);
}

function getPollPreviewId(messageId: number, previewIndex: number) {
  return `poll-media${getMessageHtmlId(messageId, previewIndex)}`;
}

function renderPollMedia({
  content,
  theme,
  className,
  previewIndex,
  previewId,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  onOpenLocation,
  onOpenPreview,
  locationWidth = ATTACHED_MAP_WIDTH,
  locationHeight = ATTACHED_MAP_HEIGHT,
  isNestedMedia,
}: {
  content: MediaContent;
  theme: ThemeKey;
  className?: string;
  previewIndex?: number;
  previewId?: string;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onOpenLocation: (location: ApiLocation) => void;
  onOpenPreview: (previewIndex: number) => void;
  locationWidth?: number;
  locationHeight?: number;
  isNestedMedia?: boolean;
}) {
  if (content.photo) {
    return (
      <Photo
        id={previewId}
        photo={content.photo}
        theme={theme}
        className={className}
        isNestedMedia={isNestedMedia}
        canAutoLoad
        observeIntersection={observeIntersectionForLoading}
        clickArg={previewIndex}
        onClick={previewIndex !== undefined ? onPreviewClick(onOpenPreview) : undefined}
      />
    );
  }

  if (content.video) {
    return (
      <Video
        id={previewId}
        video={content.video}
        className={className}
        isNestedMedia={isNestedMedia}
        canAutoLoad
        observeIntersectionForLoading={observeIntersectionForLoading}
        observeIntersectionForPlaying={observeIntersectionForPlaying}
        clickArg={previewIndex}
        onClick={previewIndex !== undefined ? onPreviewClick(onOpenPreview) : undefined}
      />
    );
  }

  if (content.document) {
    return (
      <Document
        id={previewId}
        document={content.document}
        className={className}
        observeIntersection={observeIntersectionForLoading}
        onMediaClick={previewIndex !== undefined ? () => onOpenPreview(previewIndex) : undefined}
      />
    );
  }

  if (content.location) {
    return (
      <CompactMapPreview
        className={buildClassName(className, 'media-inner')}
        geo={content.location.geo}
        width={locationWidth}
        height={locationHeight}
        zoom={ATTACHED_MAP_ZOOM}
        shouldShowPin={false}
        onClick={() => onOpenLocation(content.location!)}
      />
    );
  }

  if (content.sticker) {
    return (
      <PollSticker
        sticker={content.sticker}
        observeIntersectionForLoading={observeIntersectionForLoading}
        observeIntersectionForPlaying={observeIntersectionForPlaying}
      />
    );
  }

  return undefined;
}

function PollSticker({
  sticker,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
}: {
  sticker: ApiSticker;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
}) {
  const ref = useRef<HTMLDivElement>();

  return (
    <div className={styles.stickerPreview} ref={ref}>
      <StickerView
        containerRef={ref}
        sticker={sticker}
        size={STICKER_PREVIEW_SIZE}
        shouldLoop
        observeIntersectionForLoading={observeIntersectionForLoading}
        observeIntersectionForPlaying={observeIntersectionForPlaying}
      />
    </div>
  );
}

function hasPollOptionMedia(answer: ApiPoll['answers'][number]) {
  return Boolean(answer.media?.photo || answer.media?.video || answer.media?.location || answer.media?.sticker);
}

function onPreviewClick(onOpenPreview: (previewIndex: number) => void) {
  return (previewIndex: number, e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    onOpenPreview(previewIndex);
  };
}

export default memo(Poll);
