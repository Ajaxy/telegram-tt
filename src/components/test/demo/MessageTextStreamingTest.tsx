import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';

import type { ApiMessage, ApiMessageEntity } from '../../../api/types';
import { ApiMessageEntityTypes } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import MessageText from '../../common/MessageText';
import Button from '../../ui/Button';

import styles from './MessageTextStreamingTest.module.scss';

const MIN_CHUNK_DELAY_MS = 1500;
const MAX_CHUNK_DELAY_MS = 1500;
const MIN_CHUNK_SIZE = 1;
const MAX_CHUNK_SIZE = 5;

const MOCK_MESSAGE: ApiMessage = {
  id: 1,
  chatId: '1',
  content: {
    text: {
      text: '',
    },
  },
  date: 0,
  isOutgoing: true,
};

function splitIntoSentences(text: string) {
  return (text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function pickRandomInteger(minValue: number, maxValue: number) {
  return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
}

const ENTITY_TYPES = [ApiMessageEntityTypes.Bold, ApiMessageEntityTypes.Code] as const;
const ENTITY_MIN_LEN = 5;
const ENTITY_MAX_LEN = 60;
const ENTITY_GAP = 10;
const ENTITY_COUNT = 8;

function generateRandomEntities(textLength: number): ApiMessageEntity[] {
  const entities: ApiMessageEntity[] = [];
  let cursor = pickRandomInteger(0, ENTITY_GAP);

  for (let i = 0; i < ENTITY_COUNT && cursor < textLength; i++) {
    const maxLen = Math.min(ENTITY_MAX_LEN, textLength - cursor);
    if (maxLen < ENTITY_MIN_LEN) break;

    const length = pickRandomInteger(ENTITY_MIN_LEN, maxLen);
    const type = ENTITY_TYPES[i % ENTITY_TYPES.length];

    entities.push({ type, offset: cursor, length });
    cursor += length + pickRandomInteger(ENTITY_GAP, ENTITY_GAP * 3);
  }

  return entities;
}

const MessageTextStreamingTest = () => {
  const lang = useLang();

  const timeoutRef = useRef<number>();
  const runIdRef = useRef(0);

  const [displayedText, setDisplayedText] = useState('');
  const [shownSentenceCount, setShownSentenceCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const { sentences, entities } = useMemo(() => {
    const chunks: string[] = [
      lang('SuggestionBirthdaySetupTitle'),
      lang('ProfileBirthdayTodayValue', { date: 'January 1' }),
      lang('PremiumPreviewReactionsDescription'),
      lang('SuggestedPostAgreementReached'),
      lang('SuggestedPostPublishScheduleYou', { peer: 'Test', date: 'April 15' }),
      lang('MonetizationInfoTONTitle'),
      lang('PremiumPreviewAdvancedChatManagementDescription'),
      lang('PremiumPreviewAnimatedProfilesDescription'),
      lang('SponsoredMessageInfoDescription1'),
      lang('SponsoredMessageInfoDescription3'),
      lang('SuggestedPostChargedYou', { amount: '⭐️250' }),
      lang('PremiumPreviewStickersDescription'),
      lang('SuggestedPostRefundYou', { peer: 'Test', duration: '48 hours' }),
      lang('PremiumPreviewNoAdsDescription'),
      lang('AreYouSureShareMyContactInfoBot'),
    ];
    const fullText = chunks.join(' ');
    return {
      sentences: splitIntoSentences(fullText),
      entities: generateRandomEntities(fullText.length),
    };
  }, [lang]);

  const clearStreamingTimeout = useLastCallback(() => {
    if (timeoutRef.current === undefined) {
      return;
    }

    clearTimeout(timeoutRef.current);
    timeoutRef.current = undefined;
  });

  const appendNextChunk = useLastCallback((startIndex: number, runId: number) => {
    if (runId !== runIdRef.current) {
      return;
    }

    if (!sentences.length || startIndex >= sentences.length) {
      setIsFinished(true);
      timeoutRef.current = undefined;
      return;
    }

    const nextIndex = Math.min(
      startIndex + pickRandomInteger(MIN_CHUNK_SIZE, MAX_CHUNK_SIZE),
      sentences.length,
    );

    setDisplayedText(sentences.slice(0, nextIndex).join(' '));
    setShownSentenceCount(nextIndex);

    if (nextIndex >= sentences.length) {
      setIsFinished(true);
      timeoutRef.current = undefined;
      return;
    }

    timeoutRef.current = window.setTimeout(() => {
      appendNextChunk(nextIndex, runId);
    }, pickRandomInteger(MIN_CHUNK_DELAY_MS, MAX_CHUNK_DELAY_MS));
  });

  const restartStreaming = useLastCallback(() => {
    clearStreamingTimeout();

    runIdRef.current += 1;

    setDisplayedText('');
    setShownSentenceCount(0);
    setIsFinished(false);

    const runId = runIdRef.current;
    appendNextChunk(0, runId);
  });

  useEffect(() => {
    restartStreaming();

    return () => {
      clearStreamingTimeout();
    };
  }, [clearStreamingTimeout, restartStreaming, sentences]);

  return (
    <div className={buildClassName(styles.root, 'full-height')}>
      <div className={styles.content}>
        <div className={styles.header}>
          <Button className={styles.restartButton} onClick={restartStreaming}>
            {lang('BotRestart')}
          </Button>
        </div>

        <div className={styles.meta}>
          <span className={styles.statusBadge}>
            {lang(isFinished ? 'GiftAuctionFinished' : 'Loading')}
          </span>

          <span className={styles.progress}>
            {lang('FileTransferProgress', {
              currentSize: lang.number(shownSentenceCount),
              totalSize: lang.number(sentences.length),
            })}
          </span>
        </div>

        <div className={styles.stage}>
          <div className={styles.device}>
            <div className={styles.screen}>
              <div className={styles.draftLabel}>{lang('Draft')}</div>

              <div className={styles.bubble} dir="auto">
                <div className={styles.bubbleText}>
                  <MessageText
                    messageOrStory={MOCK_MESSAGE}
                    forcedText={{ text: displayedText, entities }}
                    canBeEmpty
                    shouldAnimateTyping
                    canAnimateTextStreaming
                  />
                </div>
              </div>
              <div className={styles.scrollSnapEnd} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(MessageTextStreamingTest);
