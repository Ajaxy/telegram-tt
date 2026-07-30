import { Markdown } from '@tiptap/markdown';
import { Plugin } from '@tiptap/pm/state';

import { buildCustomEmojiMarkdownAttrs } from '../../../../util/tiptap/extensions/customEmoji';
import { buildFormattedDateMarkdownAttrs } from '../../../../util/tiptap/extensions/date';
import { buildMentionMarkdownAttrs } from '../../../../util/tiptap/extensions/mention';
import {
  isRichMarkdownWebLink,
  parseRichMarkdownLink,
  RE_RICH_MARKDOWN_LINKS,
} from '../../../../util/tiptap/richMarkdown';

const RE_RICH_MARKDOWN_BLOCK = /^(?:#{1,6}\s|>\s?|```|\$\$|---\s*$)/m;
const RE_RICH_MARKDOWN_INLINE = /(?:\*\*|__|~~|==|\|\|)[^\n]+|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_|\$[^$\n]+\$/;
const RE_MARKDOWN_FOOTNOTE = /\[\^[^\]\n]+\](?::[^\n]*)?/g;
const RE_HTML_TAG = /<\/?[a-z][^>\n]*>/gi;

export const RichEditorMarkdown = Markdown.extend({
  addProseMirrorPlugins() {
    const { editor } = this;

    return [new Plugin({
      props: {
        handlePaste: (_view, event) => {
          const markdown = event.clipboardData?.getData('text/plain');
          const { $from } = editor.state.selection;
          if (
            !markdown
            || event.clipboardData?.getData('text/html')
            || $from.parent.type.spec.code
            || $from.marks().some(({ type }) => type.spec.code)
            || (
              !RE_RICH_MARKDOWN_BLOCK.test(markdown)
              && !RE_RICH_MARKDOWN_INLINE.test(markdown)
              && markdown.search(RE_RICH_MARKDOWN_LINKS) < 0
            )
          ) {
            return false;
          }

          return editor.commands.insertContent(preserveUnsupportedMarkdown(markdown), {
            contentType: 'markdown',
          });
        },
      },
    })];
  },
});

function preserveUnsupportedMarkdown(markdown: string) {
  return markdown
    .replace(RE_RICH_MARKDOWN_LINKS, preserveSupportedMarkdownLink)
    .replace(RE_MARKDOWN_FOOTNOTE, escapeMarkdownOpeningBracket)
    .replace(RE_HTML_TAG, (tag) => `\\${tag}`);
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
