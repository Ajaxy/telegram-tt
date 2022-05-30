import type { MouseEvent as ReactMouseEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';

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
}[]> = new Map();

const buildClassName = createClassNameBuilder('Spoiler');

const Spoiler: FC<OwnProps> = ({
  children,
  messageId,
}) => {
  // eslint-disable-next-line no-null/no-null
  const contentRef = useRef<HTMLDivElement>(null);

  const [isRevealed, reveal, conceal] = useFlag();

  const handleClick = useCallback((e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => {
    e.preventDefault();
    e.stopPropagation();

    actionsByMessageId.get(messageId!)?.forEach((actions) => actions.reveal());

    const contentLength = contentRef.current!.innerText.length;
    const readingMs = Math.round(contentLength / READING_SYMBOLS_PER_SECOND) * 1000;
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

    if (actionsByMessageId.has(messageId)) {
      actionsByMessageId.get(messageId)!.push({ reveal, conceal });
    } else {
      actionsByMessageId.set(messageId, [{ reveal, conceal }]);
    }

    return () => {
      actionsByMessageId.delete(messageId);
    };
  }, [conceal, handleClick, isRevealed, messageId, reveal]);

  return (
    <span
      className={buildClassName(
        '&',
        !isRevealed && 'concealed',
        !isRevealed && Boolean(messageId) && 'animated',
      )}
      onClick={messageId && !isRevealed ? handleClick : undefined}
    >
      <span className={buildClassName('content')} ref={contentRef}>
        {children}
      </span>
    </span>
  );
};

export default memo(Spoiler);
