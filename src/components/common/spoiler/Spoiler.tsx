import React, {
  memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';

import type { FC } from '../../../lib/teact/teact';
import { ApiMessageEntityTypes } from '../../../api/types';

import { createClassNameBuilder } from '../../../util/buildClassName';
import useFlag from '../../../hooks/useFlag';

import './Spoiler.scss';

type OwnProps = {
  children?: React.ReactNode;
  messageId?: number;
};

const READING_SYMBOLS_PER_SECOND = 23; // Heuristics
const MIN_HIDE_TIMEOUT = 5000; // 5s
const MAX_HIDE_TIMEOUT = 60000; // 1m

const actionsByMessageId: Map<number, {
  reveal: VoidFunction;
  conceal: VoidFunction;
  contentLength: number;
}[]> = new Map();

const buildClassName = createClassNameBuilder('Spoiler');

const Spoiler: FC<OwnProps> = ({
  children,
  messageId,
}) => {
  // eslint-disable-next-line no-null/no-null
  const contentRef = useRef<HTMLDivElement>(null);

  const [isRevealed, reveal, conceal] = useFlag();

  const getContentLength = useCallback(() => {
    if (!contentRef.current) {
      return 0;
    }

    const textLength = contentRef.current.textContent?.length || 0;
    const emojiCount = contentRef.current.querySelectorAll('.emoji').length;
    // Optimization: ignore alt, assume that viewing emoji takes same time as viewing 4 characters
    return textLength + emojiCount * 4;
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.preventDefault();
    e.stopPropagation();

    actionsByMessageId.get(messageId!)?.forEach((actions) => actions.reveal());

    const totalContentLength = actionsByMessageId.get(messageId!)
      ?.reduce((acc, actions) => acc + actions.contentLength, 0) || 0;
    const readingMs = Math.round(totalContentLength / READING_SYMBOLS_PER_SECOND) * 1000;
    const timeoutMs = Math.max(MIN_HIDE_TIMEOUT, Math.min(readingMs, MAX_HIDE_TIMEOUT));

    setTimeout(() => {
      actionsByMessageId.get(messageId!)?.forEach((actions) => actions.conceal());
      conceal();
    }, timeoutMs);
  }, [conceal, messageId]);

  useEffect(() => {
    if (!messageId) {
      return undefined;
    }

    const contentLength = getContentLength();

    if (actionsByMessageId.has(messageId)) {
      actionsByMessageId.get(messageId)!.push({ reveal, conceal, contentLength });
    } else {
      actionsByMessageId.set(messageId, [{ reveal, conceal, contentLength }]);
    }

    return () => {
      actionsByMessageId.delete(messageId);
    };
  }, [conceal, getContentLength, handleClick, isRevealed, messageId, reveal]);

  return (
    <span
      className={buildClassName(
        '&',
        !isRevealed && 'concealed',
        !isRevealed && Boolean(messageId) && 'animated',
      )}
      onClick={messageId && !isRevealed ? handleClick : undefined}
      data-entity-type={ApiMessageEntityTypes.Spoiler}
    >
      <span className={buildClassName('content')} ref={contentRef}>
        {children}
      </span>
    </span>
  );
};

export default memo(Spoiler);
