import React from '../../../lib/teact/teact';
import EMOJI_REGEX from '../../../lib/twemojiRegex';

import type { TextPart } from '../../../types';

import { RE_LINK_TEMPLATE, RE_MENTION_TEMPLATE } from '../../../config';
import { IS_EMOJI_SUPPORTED } from '../../../util/environment';
import {
  fixNonStandardEmoji,
  handleEmojiLoad,
  LOADED_EMOJIS,
  nativeToUnifiedExtendedWithCache,
} from '../../../util/emoji';
import buildClassName from '../../../util/buildClassName';
import { compact } from '../../../util/iteratees';

import MentionLink from '../../middle/message/MentionLink';
import SafeLink from '../SafeLink';

export type TextFilter = (
  'escape_html' | 'hq_emoji' | 'emoji' | 'emoji_html' | 'br' | 'br_html' | 'highlight' | 'links' |
  'simple_markdown' | 'simple_markdown_html'
  );

const RE_LETTER_OR_DIGIT = /^[\d\wа-яё]$/i;
const SIMPLE_MARKDOWN_REGEX = /(\*\*|__).+?\1/g;

export default function renderText(
  part: TextPart,
  filters: Array<TextFilter> = ['emoji'],
  params?: { highlight: string | undefined },
): TextPart[] {
  if (typeof part !== 'string') {
    return [part];
  }

  return compact(filters.reduce((text, filter) => {
    switch (filter) {
      case 'escape_html':
        return escapeHtml(text);

      case 'hq_emoji':
        EMOJI_REGEX.lastIndex = 0;
        return replaceEmojis(text, 'big', 'jsx');

      case 'emoji':
        EMOJI_REGEX.lastIndex = 0;
        return replaceEmojis(text, 'small', 'jsx');

      case 'emoji_html':
        EMOJI_REGEX.lastIndex = 0;
        return replaceEmojis(text, 'small', 'html');

      case 'br':
        return addLineBreaks(text, 'jsx');

      case 'br_html':
        return addLineBreaks(text, 'html');

      case 'highlight':
        return addHighlight(text, params!.highlight);

      case 'links':
        return addLinks(text);

      case 'simple_markdown':
        return replaceSimpleMarkdown(text, 'jsx');

      case 'simple_markdown_html':
        return replaceSimpleMarkdown(text, 'html');
    }

    return text;
  }, [part] as TextPart[]));
}

function escapeHtml(textParts: TextPart[]): TextPart[] {
  const divEl = document.createElement('div');
  return textParts.reduce((result: TextPart[], part) => {
    if (typeof part !== 'string') {
      result.push(part);
      return result;
    }

    divEl.innerText = part;
    result.push(divEl.innerHTML);

    return result;
  }, []);
}

function replaceEmojis(textParts: TextPart[], size: 'big' | 'small', type: 'jsx' | 'html'): TextPart[] {
  if (IS_EMOJI_SUPPORTED) {
    return textParts;
  }

  return textParts.reduce((result: TextPart[], part: TextPart) => {
    if (typeof part !== 'string') {
      result.push(part);
      return result;
    }

    part = fixNonStandardEmoji(part);
    const parts = part.split(EMOJI_REGEX);
    const emojis: string[] = part.match(EMOJI_REGEX) || [];
    result.push(parts[0]);

    return emojis.reduce((emojiResult: TextPart[], emoji, i) => {
      const code = nativeToUnifiedExtendedWithCache(emoji);
      if (!code) return emojiResult;
      const src = `./img-apple-${size === 'big' ? '160' : '64'}/${code}.png`;
      const className = buildClassName(
        'emoji',
        size === 'small' && 'emoji-small',
      );

      if (type === 'jsx') {
        const isLoaded = LOADED_EMOJIS.has(src);

        emojiResult.push(
          <img
            src={src}
            className={`${className}${!isLoaded ? ' opacity-transition slow shown' : ''}`}
            alt={emoji}
            data-path={src}
            onLoad={!isLoaded ? handleEmojiLoad : undefined}
          />,
        );
      }
      if (type === 'html') {
        emojiResult.push(
          // For preventing extra spaces in html
          // eslint-disable-next-line max-len
          `<img draggable="false" class="${className}" src="./img-apple-${size === 'big' ? '160' : '64'}/${code}.png" alt="${emoji}" />`,
        );
      }

      const index = i * 2 + 2;
      if (parts[index]) {
        emojiResult.push(parts[index]);
      }

      return emojiResult;
    }, result);
  }, [] as TextPart[]);
}

function addLineBreaks(textParts: TextPart[], type: 'jsx' | 'html'): TextPart[] {
  return textParts.reduce((result: TextPart[], part) => {
    if (typeof part !== 'string') {
      result.push(part);
      return result;
    }

    const splittenParts = part
      .split(/\r\n|\r|\n/g)
      .reduce((parts: TextPart[], line: string, i, source) => {
        // This adds non-breaking space if line was indented with spaces, to preserve the indentation
        const trimmedLine = line.trimLeft();
        const indentLength = line.length - trimmedLine.length;
        parts.push(String.fromCharCode(160).repeat(indentLength) + trimmedLine);

        if (i !== source.length - 1) {
          parts.push(
            type === 'jsx' ? <br /> : '<br />',
          );
        }

        return parts;
      }, []);

    return [...result, ...splittenParts];
  }, []);
}

function addHighlight(textParts: TextPart[], highlight: string | undefined): TextPart[] {
  return textParts.reduce<TextPart[]>((result, part) => {
    if (typeof part !== 'string' || !highlight) {
      result.push(part);
      return result;
    }

    const lowerCaseText = part.toLowerCase();
    const queryPosition = lowerCaseText.indexOf(highlight.toLowerCase());
    const nextSymbol = lowerCaseText[queryPosition + highlight.length];
    if (queryPosition < 0 || (nextSymbol && nextSymbol.match(RE_LETTER_OR_DIGIT))) {
      result.push(part);
      return result;
    }

    const newParts: TextPart[] = [];
    newParts.push(part.substring(0, queryPosition));
    newParts.push(
      <span className="matching-text-highlight">
        {part.substring(queryPosition, queryPosition + highlight.length)}
      </span>,
    );
    newParts.push(part.substring(queryPosition + highlight.length));

    return [...result, ...newParts];
  }, []);
}

const RE_LINK = new RegExp(`${RE_LINK_TEMPLATE}|${RE_MENTION_TEMPLATE}`, 'ig');

function addLinks(textParts: TextPart[]): TextPart[] {
  return textParts.reduce<TextPart[]>((result, part) => {
    if (typeof part !== 'string') {
      result.push(part);
      return result;
    }

    const links = part.match(RE_LINK);
    if (!links || !links.length) {
      result.push(part);
      return result;
    }

    const content: TextPart[] = [];

    let nextLink = links.shift();
    let lastIndex = 0;
    while (nextLink) {
      const index = part.indexOf(nextLink, lastIndex);
      content.push(part.substring(lastIndex, index));
      if (nextLink.startsWith('@')) {
        content.push(
          <MentionLink username={nextLink}>
            {nextLink}
          </MentionLink>,
        );
      } else {
        if (nextLink.endsWith('?')) {
          nextLink = nextLink.slice(0, nextLink.length - 1);
        }

        content.push(
          <SafeLink text={nextLink} url={nextLink} />,
        );
      }
      lastIndex = index + nextLink.length;
      nextLink = links.shift();
    }
    content.push(part.substring(lastIndex));

    return [...result, ...content];
  }, []);
}

function replaceSimpleMarkdown(textParts: TextPart[], type: 'jsx' | 'html'): TextPart[] {
  return textParts.reduce<TextPart[]>((result, part) => {
    if (typeof part !== 'string') {
      result.push(part);
      return result;
    }

    const parts = part.split(SIMPLE_MARKDOWN_REGEX);
    const entities = part.match(SIMPLE_MARKDOWN_REGEX) || [];
    result.push(parts[0]);

    return entities.reduce((entityResult: TextPart[], entity, i) => {
      if (type === 'jsx') {
        entityResult.push(
          entity.startsWith('**')
            ? <b>{entity.replace(/\*\*/g, '')}</b>
            : <i>{entity.replace(/__/g, '')}</i>,
        );
      } else {
        entityResult.push(
          entity.startsWith('**')
            ? `<b>${entity.replace(/\*\*/g, '')}</b>`
            : `<i>${entity.replace(/__/g, '')}</i>`,
        );
      }

      const index = i * 2 + 2;
      if (parts[index]) {
        entityResult.push(parts[index]);
      }

      return entityResult;
    }, result);
  }, []);
}

export function areLinesWrapping(text: string, element: HTMLElement) {
  const lines = (text.trim().match(/\n/g) || '').length + 1;
  const { lineHeight } = getComputedStyle(element);
  const lineHeightParsed = parseFloat(lineHeight.split('px')[0]);

  return element.clientHeight >= (lines + 1) * lineHeightParsed;
}
