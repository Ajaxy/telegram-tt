import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { GlobalState } from '../../../global/types';
import buildClassName from '../../../util/buildClassName';
import { formatInteger } from '../../../util/textFormat';

import './MessageCountBadge.scss';

type MessageCounterStatus = 'idle' | 'queued' | 'processing' | 'completed';

interface MessageCountBadgeProps {
  count?: number;
  isLoading?: boolean;
  error?: Error | null;
  status?: MessageCounterStatus;
  isPaused?: boolean;
}

const MessageCountBadge: FC<MessageCountBadgeProps> = ({
  count = 0,
  isLoading = false,
  error = null,
  status = 'idle',
  isPaused = false,
}) => {
  let displayText = '';
  
  if (error) {
    displayText = '!';
  } else if (isLoading) {
    displayText = 'Подсчет сообщений...';
  } else if (status === 'processing') {
    displayText = 'Выполняется...';
  } else if (typeof count === 'number' && count > 0) {
    displayText = formatInteger(count);
  }

  const className = buildClassName(
    'MessageCountBadge',
    isLoading && 'loading',
    Boolean(error) && 'error',
    status === 'processing' && 'processing',
    status && `status-${status}`,
    displayText && 'has-content'
  );

  return (
    <div className={className}>
      <span className="count">{displayText}</span>
    </div>
  );
};

export default memo(withGlobal<MessageCountBadgeProps>(
  (global): MessageCountBadgeProps => {
    return {
      count: 0,
      isLoading: false,
      error: null,
      status: 'idle',
      isPaused: false,
    };
  },
)(MessageCountBadge)); 