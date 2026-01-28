import { memo, useCallback, useState } from '../../../../lib/teact/teact';

import type { ToolCall } from '../../../agent/types';

import buildClassName from '../../../../util/buildClassName';

import Icon from '../../../../components/common/icons/Icon';

import styles from './ToolCallCard.module.scss';

interface OwnProps {
  toolCall: ToolCall;
  status?: 'pending' | 'running' | 'completed' | 'failed';
}

function getToolIcon(toolName: string): string {
  const iconMap: Record<string, string> = {
    listChats: 'chats',
    getChatInfo: 'info',
    openChat: 'arrow-right',
    archiveChat: 'archive',
    unarchiveChat: 'unarchive',
    pinChat: 'pin',
    unpinChat: 'unpin',
    muteChat: 'mute',
    unmuteChat: 'unmute',
    deleteChat: 'delete',
    sendMessage: 'send',
    forwardMessages: 'forward',
    deleteMessages: 'delete',
    searchMessages: 'search',
    getRecentMessages: 'document',
    markChatAsRead: 'check',
    listFolders: 'folder',
    createFolder: 'add',
    addChatToFolder: 'folder',
    removeChatFromFolder: 'folder',
    deleteFolder: 'delete',
    getChatMembers: 'group',
    addChatMembers: 'add-user',
    removeChatMember: 'remove-user',
    searchUsers: 'search',
    getUserInfo: 'user',
    batchSendMessage: 'send',
    batchAddToFolder: 'folder',
    batchArchive: 'archive',
  };
  return iconMap[toolName] || 'bots';
}

function formatToolName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function getStatusIcon(status?: string): string {
  switch (status) {
    case 'running': return 'timer';
    case 'completed': return 'check';
    case 'failed': return 'close';
    default: return 'more';
  }
}

const ToolCallCard = ({ toolCall, status = 'pending' }: OwnProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(toolCall.function.arguments || '{}');
  } catch {
    // Ignore parse errors
  }

  const hasArgs = Object.keys(args).length > 0;

  // Compact inline display - just icon, name, and status
  return (
    <div className={buildClassName(styles.toolCard, styles[status], styles.compact)}>
      <button
        type="button"
        className={styles.cardHeader}
        onClick={hasArgs ? handleToggle : undefined}
      >
        <Icon name={getToolIcon(toolCall.function.name)} className={styles.toolIcon} />
        <span className={styles.toolName}>{formatToolName(toolCall.function.name)}</span>
        <Icon name={getStatusIcon(status)} className={buildClassName(styles.statusIcon, styles[status])} />
        {hasArgs && (
          <Icon name={isExpanded ? 'up' : 'down'} className={styles.chevron} />
        )}
      </button>

      {isExpanded && hasArgs && (
        <div className={styles.cardContent}>
          <pre className={styles.codeBlock}>
            <code>{JSON.stringify(args, undefined, 2)}</code>
          </pre>
        </div>
      )}
    </div>
  );
};

export default memo(ToolCallCard);
