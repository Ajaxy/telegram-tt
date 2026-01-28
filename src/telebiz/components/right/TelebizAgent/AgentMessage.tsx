import { memo, useMemo } from '../../../../lib/teact/teact';

import type { AgentMessage as AgentMessageType } from '../../../agent/types';

import buildClassName from '../../../../util/buildClassName';

import { useTelebizLang } from '../../../hooks/useTelebizLang';

import ParsedContent from './ParsedContent';
import ToolCallChip from './ToolCallChip';

import styles from './AgentMessage.module.scss';

// Tools that should be displayed as "thinking" instead of tool calls
const THINKING_TOOLS = new Set([
  'getTrainingData',
  'getAllTrainingData',
  'useSkill',
]);

// Tools that indicate a skill was loaded/used (including auto-loaded training tools)
const SKILL_TOOLS = new Set([
  'useSkill',
  'getTrainingData',
  'getAllTrainingData',
]);

interface OwnProps {
  message: AgentMessageType;
}

const AgentMessage = ({ message }: OwnProps) => {
  const lang = useTelebizLang();

  // Hide system and tool messages
  if (message.role === 'system' || message.role === 'tool') return undefined;

  const isUser = message.role === 'user';

  // Filter out "thinking" tools from visible tool calls
  const visibleToolCalls = useMemo(() => {
    if (!message.toolCalls?.length) return [];
    return message.toolCalls.filter((tc) => !THINKING_TOOLS.has(tc.function.name));
  }, [message.toolCalls]);

  // Check if a skill was actually used (not just fetched)
  const usedSkill = useMemo(() => {
    if (!message.toolCalls?.length) return false;
    return message.toolCalls.some((tc) => SKILL_TOOLS.has(tc.function.name));
  }, [message.toolCalls]);

  // Check if this message only has thinking tools (no visible content or tool calls)
  const hasOnlyThinkingTools = useMemo(() => {
    if (!message.toolCalls?.length) return false;
    const hasContent = Boolean(message.content);
    const hasVisibleTools = visibleToolCalls.length > 0;
    return !hasContent && !hasVisibleTools && message.toolCalls.length > 0;
  }, [message.toolCalls, message.content, visibleToolCalls.length]);

  return (
    <div className={buildClassName(styles.message, isUser && styles.userMessage)}>
      {/* Thought/Analyzed duration indicator */}
      {!isUser && message.thoughtDuration && message.thoughtDuration > 0 ? (
        <div className={styles.thoughtDuration}>
          {hasOnlyThinkingTools
            ? `Analyzed for ${message.thoughtDuration}s`
            : `Thought for ${message.thoughtDuration}s`}
        </div>
      ) : undefined}

      {/* Message content */}
      {message.content && (
        <div className={styles.content}>
          {isUser ? message.content : <ParsedContent content={message.content} />}
        </div>
      )}

      {/* Tool calls as inline chips (excluding thinking tools) */}
      {(visibleToolCalls.length > 0 || usedSkill) ? (
        <div className={styles.toolChips}>
          {visibleToolCalls.map((tc) => (
            <ToolCallChip key={tc.id} toolCall={tc} />
          ))}
          {/* Skill indicator - shown when a skill was used */}
          {usedSkill ? (
            <div className={styles.skillChip}>
              <i className="icon icon-document" />
              <span>{lang('Agent.Skills.UsedSkill')}</span>
            </div>
          ) : undefined}
        </div>
      ) : undefined}
    </div>
  );
};

export default memo(AgentMessage);
