import { MouseEvent as ReactMouseEvent } from 'react';
import React, {
  FC, memo, useCallback, useEffect,
} from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';
import useFlag from '../../../hooks/useFlag';

import './Spoiler.scss';

type OwnProps = {
  children?: React.ReactNode;
  messageId?: number;
};

const spoilersByMessageId: Map<number, VoidFunction[]> = new Map();

const Spoiler: FC<OwnProps> = ({
  children,
  messageId,
}) => {
  const [isRevealed, reveal] = useFlag();

  const handleClick = useCallback((e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => {
    e.preventDefault();
    e.stopPropagation();

    spoilersByMessageId.get(messageId!)?.forEach((_reveal) => _reveal());
  }, [messageId]);

  useEffect(() => {
    if (!messageId) {
      return undefined;
    }

    if (spoilersByMessageId.has(messageId)) {
      spoilersByMessageId.get(messageId)!.push(reveal);
    } else {
      spoilersByMessageId.set(messageId, [reveal]);
    }

    return () => {
      spoilersByMessageId.delete(messageId);
    };
  }, [handleClick, isRevealed, messageId, reveal]);

  return (
    <span
      className={buildClassName(
        'Spoiler',
        !isRevealed && 'concealed',
        !isRevealed && Boolean(messageId) && 'animated',
      )}
      onClick={messageId && !isRevealed ? handleClick : undefined}
    >
      <span>
        {children}
      </span>
    </span>
  );
};

export default memo(Spoiler);
