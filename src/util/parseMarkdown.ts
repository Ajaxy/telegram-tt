import { ApiMessageEntityTypes } from '../api/types';

import { IS_EMOJI_SUPPORTED } from './windowEnvironment';

interface TextNode {
  type: 'text';
  content: string;
}

interface BoldNode {
  type: 'bold';
  children: Node[];
}

interface ItalicNode {
  type: 'italic';
  children: Node[];
}

interface StrikeNode {
  type: 'strike';
  children: Node[];
}

interface SpoilerNode {
  type: 'spoiler';
  children: Node[];
}

interface CodeNode {
  type: 'code';
  content: string;
}

interface PreNode {
  type: 'pre';
  language: string;
  content: string;
}

interface EmojiNode {
  type: 'emoji';
  alt: string;
  id: string;
}

type Node =
  | TextNode
  | BoldNode
  | ItalicNode
  | StrikeNode
  | SpoilerNode
  | CodeNode
  | PreNode
  | EmojiNode;

export function parseMarkdown(input: string): string {
  input = normalizeHtml(input);

  let index = 0;

  function parseNodes(endMarker: string | undefined): Node[] {
    const nodes: Node[] = [];
    let textBuffer = '';

    function flushText(): void {
      if (textBuffer.length > 0) {
        nodes.push({ type: 'text', content: textBuffer });
        textBuffer = '';
      }
    }

    while (index < input.length) {
      if (endMarker && input.startsWith(endMarker, index)) {
        flushText();
        index += endMarker.length;
        return nodes;
      }

      if (input.startsWith('```', index)) {
        flushText();
        index += 3;

        let lang = '';
        while (index < input.length && input[index] !== '\n' && input[index] !== '\r') {
          lang += input[index];
          index++;
        }
        lang = lang.trim();

        while (index < input.length && (input[index] === '\n' || input[index] === '\r')) {
          index++;
        }

        const codeEnd = input.indexOf('```', index);
        let codeContent: string;
        if (codeEnd !== -1) {
          codeContent = input.substring(index, codeEnd);
          index = codeEnd + 3;
        } else {
          codeContent = input.substring(index);
          index = input.length;
        }
        nodes.push({ type: 'pre', language: lang, content: codeContent });
        continue;
      }

      if (input.startsWith('`', index)) {
        flushText();
        index++;
        const codeEnd = input.indexOf('`', index);
        let codeContent: string;
        if (codeEnd !== -1) {
          codeContent = input.substring(index, codeEnd);
          index = codeEnd + 1;
        } else {
          codeContent = input.substring(index);
          index = input.length;
        }
        nodes.push({ type: 'code', content: codeContent });
        continue;
      }

      if (input.startsWith('**', index)) {
        flushText();
        index += 2;
        const children = parseNodes('**');
        nodes.push({ type: 'bold', children });
        continue;
      }

      if (input.startsWith('__', index)) {
        flushText();
        index += 2;
        const children = parseNodes('__');
        nodes.push({ type: 'italic', children });
        continue;
      }

      if (input.startsWith('~~', index)) {
        flushText();
        index += 2;
        const children = parseNodes('~~');
        nodes.push({ type: 'strike', children });
        continue;
      }

      if (input.startsWith('||', index)) {
        flushText();
        index += 2;
        const children = parseNodes('||');
        nodes.push({ type: 'spoiler', children });
        continue;
      }

      if (input[index] === '[') {
        const closingBracket = input.indexOf(']', index);
        const openingParen = input.indexOf('(', closingBracket);
        const closingParen = input.indexOf(')', openingParen);
        if (
          closingBracket !== -1
          && openingParen !== -1
          && closingParen !== -1
        ) {
          const label = input.substring(index + 1, closingBracket);
          const inner = input.substring(openingParen + 1, closingParen);
          if (inner.startsWith('customEmoji:')) {
            flushText();
            const emojiId = inner.substring('customEmoji:'.length);
            nodes.push({ type: 'emoji', alt: label, id: emojiId });
            index = closingParen + 1;
            continue;
          }
        }
      }

      textBuffer += input[index];
      index++;
    }
    flushText();
    return nodes;
  }

  function renderNodes(nodes: Node[]): string {
    let html = '';
    for (const node of nodes) {
      switch (node.type) {
        case 'text':
          html += node.content;
          break;
        case 'bold':
          html += `<b>${renderNodes(node.children)}</b>`;
          break;
        case 'italic':
          html += `<i>${renderNodes(node.children)}</i>`;
          break;
        case 'strike':
          html += `<s>${renderNodes(node.children)}</s>`;
          break;
        case 'spoiler':
          html += `<span data-entity-type="${ApiMessageEntityTypes.Spoiler}">${renderNodes(node.children)}</span>`;
          break;
        case 'code':
          html += `<code>${node.content}</code>`;
          break;
        case 'pre':
          if (node.language) {
            html += `<pre data-language="${node.language}">${node.content}</pre>`;
          } else {
            html += `<pre>${node.content}</pre>`;
          }
          break;
        case 'emoji':
          if (!IS_EMOJI_SUPPORTED) {
            html += `<img alt="${node.alt}" data-document-id="${node.id}">`;
          } else {
            html += `[${node.alt}](customEmoji:${node.id})`;
          }
          break;
        default:
          html = String(html);
      }
    }
    return html;
  }

  const ast = parseNodes(undefined);
  return renderNodes(ast);
}

function normalizeHtml(html: string): string {
  return html
    .replace(/&nbsp;/g, ' ')
    .replace(/<div><br([^>]*)?><\/div>/g, '\n')
    .replace(/<br([^>]*)?>/g, '\n')
    .replace(/<\/div>(\s*)<div>/g, '\n')
    .replace(/<div>/g, '\n')
    .replace(/<\/div>/g, '');
}
