import {
  InputRule,
  type MarkdownParseHelpers,
  type MarkdownToken,
  type MarkdownTokenizer,
} from '@tiptap/core';
import type { NodeType } from '@tiptap/pm/model';

export type RichMarkdownLink = {
  label: string;
  href: string;
  url: URL;
  isImage: boolean;
};

type BuildRichMarkdownAttrs<Attrs extends object> = (markdown: RichMarkdownLink) => Attrs | undefined;

const RICH_MARKDOWN_LINK_PATTERN = String.raw`(!?)\[((?:\\[\x20-\x7E]|[^\\\]\n])*)\]\(((?:\\[\x20-\x7E]|[^\\)\n])+)\)`;
export const RE_RICH_MARKDOWN_LINK_INPUT = new RegExp(`${RICH_MARKDOWN_LINK_PATTERN}$`);
export const RE_RICH_MARKDOWN_LINKS = new RegExp(RICH_MARKDOWN_LINK_PATTERN, 'g');
const RE_RICH_MARKDOWN_LINK = new RegExp(`^${RICH_MARKDOWN_LINK_PATTERN}$`);
const RE_RICH_MARKDOWN_LINK_START = new RegExp(`^${RICH_MARKDOWN_LINK_PATTERN}`);
const RE_RICH_MARKDOWN_ESCAPE = /\\([\x20-\x7E])/g;

export function parseRichMarkdownLink(value: string) {
  const match = value.match(RE_RICH_MARKDOWN_LINK);
  if (!match) {
    return undefined;
  }

  return buildRichMarkdownLink(
    unescapeRichMarkdown(match[2]),
    unescapeRichMarkdown(match[3]),
    Boolean(match[1]),
  );
}

export function parseRichMarkdownToken(token: MarkdownToken, isImage: boolean) {
  const label = typeof token.text === 'string' ? token.text : '';
  const href = typeof token.href === 'string' ? token.href : '';

  return buildRichMarkdownLink(label, href, isImage);
}

export function parseRichMarkdownNode<Attrs extends object>(
  token: MarkdownToken,
  helpers: MarkdownParseHelpers,
  isImage: boolean,
  nodeType: string,
  buildAttrs: BuildRichMarkdownAttrs<Attrs>,
  hasContent?: boolean,
) {
  const markdown = parseRichMarkdownToken(token, isImage);
  const attrs = markdown && buildAttrs(markdown);

  return attrs
    ? helpers.createNode(
      nodeType,
      attrs,
      hasContent ? helpers.parseInline(token.tokens || []) : undefined,
    )
    : [];
}

export function buildRichMarkdownNodeInputRule<Attrs extends object>(
  type: NodeType,
  buildAttrs: BuildRichMarkdownAttrs<Attrs>,
  hasContent?: boolean,
) {
  return new InputRule({
    find: RE_RICH_MARKDOWN_LINK_INPUT,
    handler: ({ state, range, match }) => {
      const markdown = parseRichMarkdownLink(match[0]);
      const attrs = markdown && buildAttrs(markdown);
      if (!markdown || !attrs) {
        return;
      }

      const content = hasContent ? state.schema.text(markdown.label) : undefined;
      state.tr.replaceWith(range.from, range.to, type.create(attrs, content)).scrollIntoView();
    },
  });
}

export function buildRichMarkdownTokenizer<Attrs extends object>(
  name: string,
  isImage: boolean,
  buildAttrs: BuildRichMarkdownAttrs<Attrs>,
  hasContent?: boolean,
): MarkdownTokenizer {
  const prefix = isImage ? '![' : '[';

  return {
    name,
    level: 'inline',
    start: (source) => source.indexOf(prefix),
    tokenize: (source, _tokens, lexer) => {
      const match = source.match(RE_RICH_MARKDOWN_LINK_START);
      const markdown = match && parseRichMarkdownLink(match[0]);
      if (!markdown || markdown.isImage !== isImage || !buildAttrs(markdown)) {
        return undefined;
      }

      return {
        type: name,
        raw: match[0],
        text: markdown.label,
        href: markdown.href,
        tokens: hasContent ? lexer.inlineTokens(match[2]) : [],
      };
    },
  };
}

export function isRichMarkdownWebLink(markdown: RichMarkdownLink) {
  return !markdown.isImage
    && Boolean(markdown.label.trim())
    && (markdown.url.protocol === 'http:' || markdown.url.protocol === 'https:');
}

export function escapeRichMarkdownLabel(value: string | number | undefined) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]');
}

export function escapeRichMarkdownHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function buildRichMarkdownLink(label: string, href: string, isImage: boolean): RichMarkdownLink | undefined {
  try {
    return {
      label,
      href,
      url: new URL(href),
      isImage,
    };
  } catch {
    return undefined;
  }
}

function unescapeRichMarkdown(value: string) {
  return value.replace(RE_RICH_MARKDOWN_ESCAPE, '$1');
}
