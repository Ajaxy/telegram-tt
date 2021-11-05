import { ApiMessageEntity, ApiMessageEntityTypes, ApiFormattedText } from '../api/types';
import { IS_EMOJI_SUPPORTED } from './environment';

const ENTITY_CLASS_BY_NODE_NAME: Record<string, string> = {
  B: ApiMessageEntityTypes.Bold,
  STRONG: ApiMessageEntityTypes.Bold,
  I: ApiMessageEntityTypes.Italic,
  EM: ApiMessageEntityTypes.Italic,
  U: ApiMessageEntityTypes.Underline,
  S: ApiMessageEntityTypes.Strike,
  STRIKE: ApiMessageEntityTypes.Strike,
  DEL: ApiMessageEntityTypes.Strike,
  CODE: ApiMessageEntityTypes.Code,
  PRE: ApiMessageEntityTypes.Pre,
  BLOCKQUOTE: ApiMessageEntityTypes.Blockquote,
};

const MAX_TAG_DEEPNESS = 3;

export default function parseMessageInput(html: string): ApiFormattedText {
  const fragment = document.createElement('div');
  fragment.innerHTML = parseMarkdown(html);
  const text = fragment.innerText.trim().replace(/\u200b+/g, '');
  let textIndex = 0;
  let recursionDeepness = 0;
  const entities: ApiMessageEntity[] = [];

  function addEntity(node: ChildNode) {
    const { index, entity } = getEntityDataFromNode(node, text, textIndex);

    if (entity) {
      textIndex = index;
      entities.push(entity);
    } else if (node.textContent) {
      textIndex += node.textContent.length;
    }

    if (node.hasChildNodes() && recursionDeepness <= MAX_TAG_DEEPNESS) {
      recursionDeepness += 1;
      Array.from(node.childNodes).forEach(addEntity);
    }
  }

  Array.from(fragment.childNodes).forEach((node) => {
    recursionDeepness = 1;
    addEntity(node);
  });

  return {
    text,
    entities: entities.length ? entities : undefined,
  };
}

function parseMarkdown(html: string) {
  let parsedHtml = html.slice(0);

  if (!IS_EMOJI_SUPPORTED) {
    // Emojis
    parsedHtml = parsedHtml.replace(/<img[^>]+alt="([^"]+)"[^>]*>/gm, '$1');
  }

  // Strip redundant <span> tags
  parsedHtml = parsedHtml.replace(/<\/?span([^>]*)?>/g, '');

  // Strip redundant nbsp's
  parsedHtml = parsedHtml.replace(/&nbsp;/g, ' ');

  // Replace <div><br></div> with newline (new line in Safari)
  parsedHtml = parsedHtml.replace(/<div><br([^>]*)?><\/div>/g, '\n');
  // Replace <br> with newline
  parsedHtml = parsedHtml.replace(/<br([^>]*)?>/g, '\n');

  // Strip redundant <div> tags
  parsedHtml = parsedHtml.replace(/<\/div>(\s*)<div>/g, '\n');
  parsedHtml = parsedHtml.replace(/<div>/g, '\n');
  parsedHtml = parsedHtml.replace(/<\/div>/g, '');

  // Pre
  parsedHtml = parsedHtml.replace(/^`{3}(.*[\n\r][^]*?^)`{3}/gm, '<pre>$1</pre>');
  parsedHtml = parsedHtml.replace(/[`]{3}([^`]+)[`]{3}/g, '<pre>$1</pre>');

  // Code
  parsedHtml = parsedHtml.replace(/[`]{1}([^`\n]+)[`]{1}/g, '<code>$1</code>');

  // Other simple markdown
  parsedHtml = parsedHtml.replace(/[*]{2}([^*\n]+)[*]{2}/g, '<b>$1</b>');
  parsedHtml = parsedHtml.replace(/[_]{2}([^*\n]+)[_]{2}/g, '<i>$1</i>');
  parsedHtml = parsedHtml.replace(/[~]{2}([^~\n]+)[~]{2}/g, '<s>$1</s>');

  return parsedHtml;
}

function getEntityDataFromNode(
  node: ChildNode,
  rawText: string,
  textIndex: number,
): { index: number; entity?: ApiMessageEntity } {
  const type = getEntityTypeFromNode(node);
  if (!type || !node.textContent) {
    return {
      index: textIndex,
      entity: undefined,
    };
  }

  const rawIndex = rawText.indexOf(node.textContent, textIndex);
  // In some cases, last text entity ends with a newline (which gets trimmed from `rawText`).
  // In this case, `rawIndex` would return `-1`, so we use `textIndex` instead.
  const index = rawIndex >= 0 ? rawIndex : textIndex;
  const offset = rawText.substring(0, index).length;
  const { length } = rawText.substring(index, index + node.textContent.length);

  let url: string | undefined;
  let userId: string | undefined;
  if (type === ApiMessageEntityTypes.TextUrl) {
    url = (node as HTMLAnchorElement).href;
  }
  if (type === ApiMessageEntityTypes.MentionName) {
    userId = (node as HTMLAnchorElement).dataset.userId;
  }

  return {
    index,
    entity: {
      type,
      offset,
      length,
      ...(url && { url }),
      ...(userId && { userId }),
    },
  };
}

function getEntityTypeFromNode(node: ChildNode) {
  if (ENTITY_CLASS_BY_NODE_NAME[node.nodeName]) {
    return ENTITY_CLASS_BY_NODE_NAME[node.nodeName];
  }

  if (node.nodeName === 'A') {
    const anchor = node as HTMLAnchorElement;
    if (anchor.dataset.entityType === ApiMessageEntityTypes.MentionName) {
      return ApiMessageEntityTypes.MentionName;
    }
    if (anchor.dataset.entityType === ApiMessageEntityTypes.Url) {
      return ApiMessageEntityTypes.Url;
    }
    if (anchor.href.startsWith('mailto:')) {
      return ApiMessageEntityTypes.Email;
    }
    if (anchor.href.startsWith('tel:')) {
      return ApiMessageEntityTypes.Phone;
    }
    if (anchor.href !== anchor.textContent) {
      return ApiMessageEntityTypes.TextUrl;
    }

    return ApiMessageEntityTypes.Url;
  }

  if (node.nodeName === 'SPAN') {
    return (node as HTMLElement).dataset.entityType;
  }

  return undefined;
}
