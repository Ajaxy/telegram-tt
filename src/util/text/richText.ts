import type { ApiPageBlock, ApiPageCaption, ApiRichText } from '../../api/types';

export function hasRichText(text: ApiRichText): boolean {
  switch (text.type) {
    case 'empty':
      return false;
    case 'plain':
      return Boolean(text.text);
    case 'concat':
      return text.texts.some(hasRichText);
    case 'image':
    case 'math':
    case 'customEmoji':
      return true;
    default:
      return hasRichText(text.text);
  }
}

// Visits the node and its descendants; return `false` to skip the node's children
export function forEachRichTextNode(text: ApiRichText, callback: (node: ApiRichText) => boolean | void) {
  if (callback(text) === false) return;

  switch (text.type) {
    case 'empty':
    case 'plain':
    case 'image':
    case 'math':
    case 'customEmoji':
      break;
    case 'concat':
      text.texts.forEach((part) => forEachRichTextNode(part, callback));
      break;
    default:
      forEachRichTextNode(text.text, callback);
      break;
  }
}

/**
 * Visits every rich text slot of the blocks in document order, descending into nested blocks.
 * A math block is passed as its own text node. Return `false` from `onBlock` to skip the block.
 */
export function forEachPageBlocksRichText(
  blocks: ApiPageBlock[],
  onText: (text: ApiRichText) => void,
  onBlock?: (block: ApiPageBlock) => boolean | void,
) {
  blocks.forEach((block) => forEachPageBlockRichText(block, onText, onBlock));
}

function forEachPageBlockRichText(
  block: ApiPageBlock,
  onText: (text: ApiRichText) => void,
  onBlock?: (block: ApiPageBlock) => boolean | void,
) {
  if (onBlock?.(block) === false) return;

  const visitCaption = (caption: ApiPageCaption) => {
    onText(caption.text);
    onText(caption.credit);
  };
  const visitBlocks = (blocks: ApiPageBlock[]) => forEachPageBlocksRichText(blocks, onText, onBlock);

  switch (block.type) {
    case 'buttonRow':
      block.buttons.forEach((button) => onText(button.text));
      break;
    case 'title':
    case 'subtitle':
    case 'header':
    case 'subheader':
    case 'paragraph':
    case 'preformatted':
    case 'footer':
    case 'kicker':
    case 'heading1':
    case 'heading2':
    case 'heading3':
    case 'heading4':
    case 'heading5':
    case 'heading6':
    case 'thinking':
      onText(block.text);
      break;
    case 'math':
      onText(block);
      break;
    case 'authorDate':
      onText(block.author);
      break;
    case 'list':
    case 'orderedList':
      block.items.forEach((item) => {
        if (item.type === 'text') {
          onText(item.text);
        } else {
          visitBlocks(item.blocks);
        }
      });
      break;
    case 'blockquote':
    case 'pullquote':
      onText(block.text);
      onText(block.caption);
      break;
    case 'blockquoteBlocks':
      visitBlocks(block.blocks);
      onText(block.caption);
      break;
    case 'photo':
    case 'video':
    case 'audio':
    case 'document':
    case 'embed':
    case 'map':
      visitCaption(block.caption);
      break;
    case 'cover':
      forEachPageBlockRichText(block.cover, onText, onBlock);
      break;
    case 'embedPost':
      visitBlocks(block.blocks);
      visitCaption(block.caption);
      break;
    case 'collage':
    case 'slideshow':
      visitBlocks(block.items);
      visitCaption(block.caption);
      break;
    case 'table':
      onText(block.title);
      block.rows.forEach((row) => row.cells.forEach((cell) => {
        if (cell.text) onText(cell.text);
      }));
      break;
    case 'details':
      onText(block.title);
      visitBlocks(block.blocks);
      break;
    case 'relatedArticles':
      onText(block.title);
      break;
    case 'unsupported':
    case 'divider':
    case 'anchor':
    case 'channel':
      break;
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}
