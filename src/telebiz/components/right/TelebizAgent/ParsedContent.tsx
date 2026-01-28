import type { TeactNode } from '../../../../lib/teact/teact';
import { memo, useCallback, useMemo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiMessageEntity } from '../../../../api/types';
import { ApiMessageEntityTypes } from '../../../../api/types';

import buildClassName from '../../../../util/buildClassName';
import { renderTextWithEntities } from '../../../../components/common/helpers/renderTextWithEntities';

import styles from './ParsedContent.module.scss';

interface OwnProps {
  content: string;
  className?: string;
}

interface ParseResult {
  text: string;
  entities: ApiMessageEntity[];
}

// Chat ID pattern: matches (123456789) or (-123456789)
const CHAT_ID_PATTERN = /\((-?\d{6,})\)/g;

// Parse markdown directly into entities without using DOM
function parseMarkdownToEntities(input: string): ParseResult {
  const entities: ApiMessageEntity[] = [];
  let text = '';
  let i = 0;

  while (i < input.length) {
    // Bold **text**
    if (input.slice(i, i + 2) === '**') {
      const endIdx = input.indexOf('**', i + 2);
      if (endIdx !== -1) {
        const content = input.slice(i + 2, endIdx);
        entities.push({
          type: ApiMessageEntityTypes.Bold,
          offset: text.length,
          length: content.length,
        });
        text += content;
        i = endIdx + 2;
        continue;
      }
    }

    // Inline code `code`
    if (input[i] === '`' && input[i + 1] !== '`') {
      const endIdx = input.indexOf('`', i + 1);
      if (endIdx !== -1) {
        const content = input.slice(i + 1, endIdx);
        entities.push({
          type: ApiMessageEntityTypes.Code,
          offset: text.length,
          length: content.length,
        });
        text += content;
        i = endIdx + 1;
        continue;
      }
    }

    // Strikethrough ~~text~~
    if (input.slice(i, i + 2) === '~~') {
      const endIdx = input.indexOf('~~', i + 2);
      if (endIdx !== -1) {
        const content = input.slice(i + 2, endIdx);
        entities.push({
          type: ApiMessageEntityTypes.Strike,
          offset: text.length,
          length: content.length,
        });
        text += content;
        i = endIdx + 2;
        continue;
      }
    }

    // Italic *text* (single asterisk, not double)
    if (input[i] === '*' && input[i + 1] !== '*' && (i === 0 || input[i - 1] !== '*')) {
      const endIdx = input.indexOf('*', i + 1);
      if (endIdx !== -1 && input[endIdx + 1] !== '*') {
        const content = input.slice(i + 1, endIdx);
        entities.push({
          type: ApiMessageEntityTypes.Italic,
          offset: text.length,
          length: content.length,
        });
        text += content;
        i = endIdx + 1;
        continue;
      }
    }

    // Regular character
    text += input[i];
    i++;
  }

  return { text, entities: entities.length > 0 ? entities : [] };
}

// Component to render a clickable chat link
interface ChatLinkProps {
  chatId: string;
  children: TeactNode;
}

const ChatLink = memo(({ chatId, children }: ChatLinkProps) => {
  const handleClick = useCallback(() => {
    const { openChat } = getActions();
    openChat({ id: chatId });
  }, [chatId]);

  return (
    <button
      type="button"
      className={styles.chatLink}
      onClick={handleClick}
    >
      {children}
    </button>
  );
});

// Split text by chat IDs and render with clickable links
function renderWithChatLinks(input: string): TeactNode[] {
  const parts: TeactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  CHAT_ID_PATTERN.lastIndex = 0;
  match = CHAT_ID_PATTERN.exec(input);
  while (match) {
    // Add text before the match
    if (match.index > lastIndex) {
      const textBefore = input.slice(lastIndex, match.index);
      const { text, entities } = parseMarkdownToEntities(textBefore);
      parts.push(
        <span key={key++}>
          {renderTextWithEntities({ text, entities: entities.length > 0 ? entities : undefined })}
        </span>,
      );
    }

    // Add the chat link
    const chatId = match[1];
    parts.push(
      <ChatLink key={key++} chatId={chatId}>
        (
        {chatId}
        )
      </ChatLink>,
    );

    lastIndex = match.index + match[0].length;
    match = CHAT_ID_PATTERN.exec(input);
  }

  // Add remaining text
  if (lastIndex < input.length) {
    const remaining = input.slice(lastIndex);
    const { text, entities } = parseMarkdownToEntities(remaining);
    parts.push(
      <span key={key++}>
        {renderTextWithEntities({ text, entities: entities.length > 0 ? entities : undefined })}
      </span>,
    );
  }

  // If no matches, just render the whole thing
  if (parts.length === 0) {
    const { text, entities } = parseMarkdownToEntities(input);
    return renderTextWithEntities({ text, entities: entities.length > 0 ? entities : undefined });
  }

  return parts;
}

// Render inline text with chat links and markdown
function renderInlineText(input: string): TeactNode[] {
  return renderWithChatLinks(input);
}

// Check if line is a numbered list item (e.g., "1. ", "2. ", "10. ")
function parseNumberedListItem(line: string): { number: number; content: string } | undefined {
  const match = line.match(/^(\d+)\.\s+(.*)$/);
  if (match) {
    return { number: parseInt(match[1], 10), content: match[2] };
  }
  return undefined;
}

// Check if line starts a code block
function isCodeBlockStart(line: string): string | undefined {
  const match = line.match(/^```(\w*)$/);
  return match ? (match[1] || 'text') : undefined;
}

const ParsedContent = ({ content, className }: OwnProps) => {
  const rendered = useMemo(() => {
    if (!content) return undefined;

    const lines = content.split('\n');
    const elements: TeactNode[] = [];

    // List state
    let inUnorderedList = false;
    let unorderedListItems: TeactNode[] = [];
    let inOrderedList = false;
    let orderedListItems: TeactNode[] = [];

    // Code block state
    let inCodeBlock = false;
    let codeBlockLanguage = '';
    let codeBlockLines: string[] = [];

    const flushUnorderedList = (key: string) => {
      if (unorderedListItems.length > 0) {
        elements.push(<ul key={key} className={styles.list}>{unorderedListItems}</ul>);
        unorderedListItems = [];
      }
      inUnorderedList = false;
    };

    const flushOrderedList = (key: string) => {
      if (orderedListItems.length > 0) {
        elements.push(<ol key={key} className={styles.orderedList}>{orderedListItems}</ol>);
        orderedListItems = [];
      }
      inOrderedList = false;
    };

    const flushCodeBlock = (key: string) => {
      if (codeBlockLines.length > 0) {
        elements.push(
          <pre key={key} className={styles.codeBlock} data-language={codeBlockLanguage}>
            <code>{codeBlockLines.join('\n')}</code>
          </pre>,
        );
        codeBlockLines = [];
      }
      inCodeBlock = false;
      codeBlockLanguage = '';
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Handle code block end
      if (inCodeBlock) {
        if (trimmed === '```') {
          flushCodeBlock(`code-${index}`);
        } else {
          codeBlockLines.push(line); // Keep original indentation
        }
        return;
      }

      // Handle code block start
      const codeBlockLang = isCodeBlockStart(trimmed);
      if (codeBlockLang !== undefined) {
        // Flush any open lists before code block
        flushUnorderedList(`ul-${index}`);
        flushOrderedList(`ol-${index}`);
        inCodeBlock = true;
        codeBlockLanguage = codeBlockLang;
        return;
      }

      // Handle unordered list items (- item)
      if (trimmed.startsWith('- ')) {
        flushOrderedList(`ol-${index}`);
        if (!inUnorderedList) {
          inUnorderedList = true;
          unorderedListItems = [];
        }
        unorderedListItems.push(
          <li key={`li-${index}`} className={styles.listItem}>
            {renderInlineText(trimmed.slice(2))}
          </li>,
        );
        return;
      }

      // Handle numbered list items (1. item)
      const numberedItem = parseNumberedListItem(trimmed);
      if (numberedItem) {
        flushUnorderedList(`ul-${index}`);
        if (!inOrderedList) {
          inOrderedList = true;
          orderedListItems = [];
        }
        orderedListItems.push(
          <li key={`oli-${index}`} className={styles.listItem}>
            {renderInlineText(numberedItem.content)}
          </li>,
        );
        return;
      }

      // End of any list
      flushUnorderedList(`ul-${index}`);
      flushOrderedList(`ol-${index}`);

      // Empty line = paragraph break
      if (!trimmed) {
        elements.push(<div key={`br-${index}`} className={styles.break} />);
        return;
      }

      // Headers (check longest first to avoid partial matches)
      if (trimmed.startsWith('#### ')) {
        elements.push(
          <h5 key={`h5-${index}`} className={styles.h5}>
            {renderInlineText(trimmed.slice(5))}
          </h5>,
        );
        return;
      }
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h4 key={`h4-${index}`} className={styles.h4}>
            {renderInlineText(trimmed.slice(4))}
          </h4>,
        );
        return;
      }
      if (trimmed.startsWith('## ')) {
        elements.push(
          <h3 key={`h3-${index}`} className={styles.h3}>
            {renderInlineText(trimmed.slice(3))}
          </h3>,
        );
        return;
      }
      if (trimmed.startsWith('# ')) {
        elements.push(
          <h2 key={`h2-${index}`} className={styles.h2}>
            {renderInlineText(trimmed.slice(2))}
          </h2>,
        );
        return;
      }

      // Regular paragraph
      elements.push(
        <div key={`line-${index}`}>
          {renderInlineText(trimmed)}
        </div>,
      );
    });

    // Flush any remaining lists or code blocks
    flushUnorderedList('ul-final');
    flushOrderedList('ol-final');
    flushCodeBlock('code-final');

    return elements;
  }, [content]);

  if (!rendered) return undefined;

  return (
    <div className={buildClassName(styles.parsedContent, className)}>
      {rendered}
    </div>
  );
};

export default memo(ParsedContent);
