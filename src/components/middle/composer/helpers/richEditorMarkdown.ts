import type {
  AnyConfig, ExtendedRegExpMatchArray, InputRuleFinder, JSONContent,
} from '@tiptap/core';
import {
  Extension, getExtensionField, getSchemaTypeByName, InputRule,
} from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import type { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model';
import { Mark } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';

import { normalizeBotApiHtml } from '../../../../util/tiptap/botApiHtml';
import { buildCustomEmojiMarkdownAttrs } from '../../../../util/tiptap/extensions/customEmoji';
import { buildFormattedDateMarkdownAttrs } from '../../../../util/tiptap/extensions/date';
import { buildMentionMarkdownAttrs } from '../../../../util/tiptap/extensions/mention';
import {
  isRichMarkdownWebLink,
  parseRichMarkdownLink,
  RE_RICH_MARKDOWN_INLINE_MATH,
  RE_RICH_MARKDOWN_LINKS,
} from '../../../../util/tiptap/richMarkdown';
import { parseRichMediaRef } from '../../../../util/tiptap/richMedia';

const RE_RICH_MARKDOWN_BLOCK = /^(?:#{1,6}\s|>\s?|```|\$\$|---\s*$)/m;
const RE_RICH_MARKDOWN_INLINE = /(?:\*\*|__|~~|==|\|\|)[^\n]+|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_/;
const RE_MARKDOWN_FOOTNOTE = /\[\^[^\]\n]+\](?::[^\n]*)?/g;
const RE_HTML_TAG = /<\/?[a-z][^>\n]*>/gi;
const RE_RICH_MEDIA_HTML = /<(?:figure|tg-collage|tg-slideshow|tg-document|img|video|audio)\b/i;
const RE_NORMALIZED_MEDIA_HTML = /<div\s+data-rich-editor-media(?:="")?[^>]*>[\s\S]*?<\/div>/gi;
const RE_MARKDOWN_MEDIA = /!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"((?:\\.|[^"\\])*)")?\)/g;
const RE_MARKDOWN_ESCAPE = /\\([\x20-\x7E])/g;
const MEDIA_PLACEHOLDER_PREFIX = 'TG_RICH_MEDIA_PLACEHOLDER_';
// MAINTENANCE: Marks whose own closer-triggered input rules are replayed for opener-last typing.
// Their finders must stay `$`-anchored, mirror the opener as the closer, and capture content last.
// Add the opener character below when adding a mark here
const REVERSE_INPUT_MARK_NAMES = new Set(['bold', 'italic', 'strike', 'code', 'spoiler', 'marked']);
const RE_REVERSE_INPUT_OPENER = /[*_~`|=]$/;
// Lower than the default 100 so a completed closer wins over an opener in the same keystroke
const REVERSE_INPUT_PRIORITY = 90;
// Matches the text window of Tiptap's closer-triggered input rules and bounds per-keystroke rescans
const MAX_INPUT_RULE_TEXT_LENGTH = 500;
const HARD_BREAK_TEXT = '\n';
// Object replacement character, which no delimiter or whitespace check matches
const INLINE_NODE_TEXT = String.fromCharCode(0xFFFC);

export const RichEditorMarkdown = Markdown.extend({
  addProseMirrorPlugins() {
    const { editor } = this;
    let isPlainTextPaste = false;

    return [new Plugin({
      props: {
        // ProseMirror runs this before `handlePaste` and sets `isPlainText` for Ctrl+Shift+V and code blocks
        transformPastedText: (text, isPlainText) => {
          isPlainTextPaste = isPlainText;
          return text;
        },
        handlePaste: (view, event, slice) => {
          const markdown = event.clipboardData?.getData('text/plain');
          const { $from } = editor.state.selection;
          const isInCode = $from.parent.type.spec.code;
          const isPlainText = isPlainTextPaste && !isInCode;
          isPlainTextPaste = false;

          // Tiptap paste rules convert `**bold**` and similar after `uiEvent: paste` transactions only
          if (isPlainText) {
            view.dispatch(view.state.tr.replaceSelection(slice).setMeta('paste', true).scrollIntoView());
            return true;
          }

          if (
            !markdown
            || event.clipboardData?.getData('text/html')
            || isInCode
            || $from.marks().some(({ type }) => type.spec.code)
            || (
              !RE_RICH_MARKDOWN_BLOCK.test(markdown)
              && !RE_RICH_MARKDOWN_INLINE.test(markdown)
              && !RE_RICH_MARKDOWN_INLINE_MATH.test(markdown)
              && markdown.search(RE_RICH_MARKDOWN_LINKS) < 0
              && !RE_RICH_MEDIA_HTML.test(markdown)
            )
          ) {
            return false;
          }

          let content: JSONContent;
          try {
            content = dropExcludedMarks(editor.markdown!.parse(preserveUnsupportedMarkdown(markdown)), editor.schema);
            // Tiptap replaces invalid content with an empty document, so fall back to plain text paste instead
            editor.schema.nodeFromJSON(content).check();
          } catch (err) {
            return false;
          }

          return editor.commands.insertContent(content);
        },
      },
    })];
  },
});

// Converts `**|text**` after the opener is typed last by running the mark's own input rules over the whole pair
export const RichEditorReverseMarkdown = Extension.create({
  name: 'richEditorReverseMarkdown',
  priority: REVERSE_INPUT_PRIORITY,

  addInputRules() {
    const { editor } = this;
    const rules = editor.extensionManager.extensions
      .filter(({ name }) => REVERSE_INPUT_MARK_NAMES.has(name))
      .flatMap((extension) => getExtensionField<AnyConfig['addInputRules']>(extension, 'addInputRules', {
        name: extension.name,
        options: extension.options,
        storage: editor.extensionStorage[extension.name as keyof typeof editor.extensionStorage],
        editor,
        type: getSchemaTypeByName(extension.name, editor.schema),
      })?.() || []);

    return [new InputRule({
      find: RE_REVERSE_INPUT_OPENER,
      handler: (props) => applyReverseMarkInputRule(props, rules),
    })];
  },
});

function applyReverseMarkInputRule(props: Parameters<InputRule['handler']>[0], rules: InputRule[]) {
  // `range.to` is the caret after the typed text, including selection replacement and composition end
  const $cursor = props.state.doc.resolve(props.range.to);
  const text = buildPositionText($cursor.parent);
  const cursor = $cursor.parentOffset;
  const delimiter = text[cursor - 1];
  // Typing inside a delimiter run is not a completed opener
  if (text[cursor] === delimiter) return undefined;

  let openerStart = cursor - 1;
  while (text[openerStart - 1] === delimiter) openerStart--;
  // Keep one boundary character so rules can check `^` or whitespace before the opener
  const matchStart = Math.max(0, openerStart - 1);
  const lineEnd = text.indexOf(HARD_BREAK_TEXT, cursor);
  const searchEnd = Math.min(lineEnd < 0 ? text.length : lineEnd, matchStart + MAX_INPUT_RULE_TEXT_LENGTH);

  for (let end = cursor + 1; end <= searchEnd; end++) {
    // Only whole closing runs, so `*|word**` stays literal until the second `*`
    if (text[end - 1] !== delimiter || text[end] === delimiter) continue;

    for (const rule of rules) {
      const match = matchInputRule(rule.find, text.slice(matchStart, end));
      if (!match) continue;

      const content = match[match.length - 1];
      const from = matchStart + match.index!;
      if (from + match[0].indexOf(content) !== cursor) continue;

      const blockStart = $cursor.start();
      return rule.handler({ ...props, range: { from: blockStart + from, to: blockStart + end }, match });
    }
  }

  return undefined;
}

// Maps each document position to one character, so inline nodes such as mentions keep exact offsets
function buildPositionText(block: ProseMirrorNode) {
  let text = '';
  block.forEach((node) => {
    text += node.isText ? node.text! : node.type.spec.linebreakReplacement
      ? HARD_BREAK_TEXT
      : INLINE_NODE_TEXT.repeat(node.nodeSize);
  });
  return text;
}

// Mirrors Tiptap's internal input rule matcher for regular expression and function finders
function matchInputRule(find: InputRuleFinder, text: string): ExtendedRegExpMatchArray | undefined {
  if (find instanceof RegExp) return find.exec(text) || undefined;

  const result = find(text);
  if (!result) return undefined;

  const match: ExtendedRegExpMatchArray = [result.text];
  if (result.replaceWith) match.push(result.replaceWith);
  match.index = result.index;
  match.input = text;
  match.data = result.data;
  return match;
}

// Markdown nests marks freely (`==a `b`==`), but the schema rejects text with `code` plus other marks
function dropExcludedMarks(node: JSONContent, schema: Schema): JSONContent {
  const marks = node.marks?.reduce<readonly Mark[]>(
    (set, mark) => schema.markFromJSON(mark).addToSet(set), Mark.none,
  );
  return {
    ...node,
    marks: marks?.map((mark) => mark.toJSON()),
    content: node.content?.map((child) => dropExcludedMarks(child, schema)),
  };
}

function preserveUnsupportedMarkdown(markdown: string) {
  const mediaHtml: string[] = [];
  const markdownWithMediaHtml = markdown.replace(RE_MARKDOWN_MEDIA, buildMarkdownMediaHtml);
  const hasMediaHtml = RE_RICH_MEDIA_HTML.test(markdownWithMediaHtml);
  const normalizedMarkdown = hasMediaHtml
    ? normalizeBotApiHtml(markdownWithMediaHtml)
    : markdownWithMediaHtml;
  const placeholderPrefix = findAvailableMediaPlaceholderPrefix(normalizedMarkdown);
  const placeholderPattern = new RegExp(`${placeholderPrefix}(\\d+)_`, 'g');
  const protectedMarkdown = hasMediaHtml
    ? normalizedMarkdown.replace(RE_NORMALIZED_MEDIA_HTML, (value) => {
      const index = mediaHtml.push(value) - 1;
      return `${placeholderPrefix}${index}_`;
    })
    : normalizedMarkdown;
  return protectedMarkdown
    .replace(RE_RICH_MARKDOWN_LINKS, preserveSupportedMarkdownLink)
    .replace(RE_MARKDOWN_FOOTNOTE, escapeMarkdownOpeningBracket)
    .replace(RE_HTML_TAG, (tag) => `\\${tag}`)
    .replace(placeholderPattern, (value, index: string) => mediaHtml[Number(index)] ?? value);
}

function findAvailableMediaPlaceholderPrefix(value: string) {
  let index = 0;
  let prefix = `${MEDIA_PLACEHOLDER_PREFIX}${index}_`;
  while (value.includes(prefix)) {
    index += 1;
    prefix = `${MEDIA_PLACEHOLDER_PREFIX}${index}_`;
  }
  return prefix;
}

function buildMarkdownMediaHtml(_value: string, rawAlt: string, source: string, rawCaption?: string) {
  const alt = unescapeMarkdown(rawAlt);
  const caption = rawCaption ? unescapeMarkdown(rawCaption) : '';
  const ref = parseRichMediaRef(source);
  if (!ref) return [alt, caption].filter(Boolean).join('\n');

  const element = document.createElement(
    ref.type === 'document' ? 'tg-document' : ref.type === 'photo' ? 'img' : ref.type,
  );
  element.setAttribute('src', source);
  element.setAttribute('alt', alt);
  if (!caption) return element.outerHTML;

  const figure = document.createElement('figure');
  const figcaption = document.createElement('figcaption');
  figcaption.dataset.tgSharedCaption = '';
  figcaption.textContent = caption;
  figure.append(element, figcaption);
  return figure.outerHTML;
}

function unescapeMarkdown(value: string) {
  return value.replace(RE_MARKDOWN_ESCAPE, '$1');
}

function preserveSupportedMarkdownLink(value: string) {
  const markdown = parseRichMarkdownLink(value);
  const isSupported = markdown && (
    isRichMarkdownWebLink(markdown)
    || Boolean(buildCustomEmojiMarkdownAttrs(markdown))
    || Boolean(buildFormattedDateMarkdownAttrs(markdown))
    || Boolean(buildMentionMarkdownAttrs(markdown))
  );

  return isSupported ? value : escapeMarkdownOpeningBracket(value);
}

function escapeMarkdownOpeningBracket(value: string) {
  return value.replace('[', '\\[');
}
