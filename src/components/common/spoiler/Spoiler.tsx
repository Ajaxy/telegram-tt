import React, {
  FC, memo, useCallback, useEffect,
} from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';
import useFlag from '../../../hooks/useFlag';

import './Spoiler.scss';

type OwnProps = {
  children?: React.ReactNode;
  messageId?: number;
  isInactive?: boolean;
};

const spoilersByMessageId: Map<number, VoidFunction[]> = new Map();

const Spoiler: FC<OwnProps> = ({
  children,
  messageId,
  isInactive,
}) => {
  const [isRevealed, reveal] = useFlag();

  const handleClick = useCallback(() => {
    if (!messageId) return;

    spoilersByMessageId.get(messageId)?.forEach((_reveal) => _reveal());
  }, [messageId]);

  useEffect(() => {
    if (isRevealed && messageId) {
      spoilersByMessageId.delete(messageId);
      return undefined;
    }

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
        isRevealed && 'is-revealed',
        !isInactive && 'animate',
      )}
      onClick={!isInactive && !isRevealed ? handleClick : undefined}
    >
      {children}
    </span>
  );
};

export default memo(Spoiler);
