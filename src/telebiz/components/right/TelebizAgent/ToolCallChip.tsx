import { memo, useCallback, useState } from '../../../../lib/teact/teact';

import type { ToolCall } from '../../../agent/types';

import buildClassName from '../../../../util/buildClassName';

import Icon from '../../../../components/common/icons/Icon';

import styles from './ToolCallChip.module.scss';

interface OwnProps {
  toolCall: ToolCall;
}

// Format tool name for display (camelCase to Title Case)
function formatToolName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

const ToolCallChip = ({ toolCall }: OwnProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClick = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(toolCall.function.arguments || '{}');
  } catch {
    // Ignore parse errors
  }

  const hasArgs = Object.keys(args).length > 0;

  return (
    <div className={styles.chipWrapper}>
      <button
        type="button"
        className={buildClassName(styles.chip, isExpanded && styles.expanded)}
        onClick={hasArgs ? handleClick : undefined}
      >
        <span className={styles.name}>{formatToolName(toolCall.function.name)}</span>
        <Icon name="check" className={styles.checkIcon} />
        {hasArgs && <Icon name={isExpanded ? 'up' : 'down'} className={styles.chevron} />}
      </button>

      {isExpanded && hasArgs && (
        <div className={styles.argsPanel}>
          <pre className={styles.argsCode}>
            {JSON.stringify(args, undefined, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default memo(ToolCallChip);
