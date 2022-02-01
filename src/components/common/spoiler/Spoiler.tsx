import { MouseEvent as ReactMouseEvent } from 'react';
import React, {
  FC, memo, useCallback, useEffect,
} from '../../../lib/teact/teact';

import { createClassNameBuilder } from '../../../util/buildClassName';
import useFlag from '../../../hooks/useFlag';

import './Spoiler.scss';

type OwnProps = {
  children?: React.ReactNode;
  messageId?: number;
};

const AUTO_HIDE_TIMEOUT = 5000; // 5s

const actionsByMessageId: Map<number, {
  reveal: VoidFunction;
  conceal: VoidFunction;
}[]> = new Map();

const buildClassName = createClassNameBuilder('Spoiler');

const Spoiler: FC<OwnProps> = ({
  children,
  messageId,
}) => {
  const [isRevealed, reveal, conceal] = useFlag();

  const handleClick = useCallback((e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => {
    e.preventDefault();
    e.stopPropagation();

    actionsByMessageId.get(messageId!)?.forEach((actions) => actions.reveal());

    setTimeout(() => {
      actionsByMessageId.get(messageId!)?.forEach((actions) => actions.conceal());
      conceal();
    }, AUTO_HIDE_TIMEOUT);
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
      <span className={buildClassName('content')}>
        {children}
      </span>
    </span>
  );
};

export default memo(Spoiler);
