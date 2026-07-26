import { Markdown } from '@tiptap/markdown';
import { Plugin } from '@tiptap/pm/state';

const RE_RICH_MARKDOWN_BLOCK = /^(?:#{1,6}\s|>\s?|```|\$\$|---\s*$)/m;
const RE_RICH_MARKDOWN_INLINE = /(?:\*\*|__|~~|==|\|\|)[^\n]+|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_|\$[^$\n]+\$/;
const RE_MARKDOWN_LINK = /!?\[[^\]\n]*\]\([^)\n]*\)/g;
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
            || (!RE_RICH_MARKDOWN_BLOCK.test(markdown) && !RE_RICH_MARKDOWN_INLINE.test(markdown))
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
    .replace(RE_MARKDOWN_LINK, escapeMarkdownOpeningBracket)
    .replace(RE_MARKDOWN_FOOTNOTE, escapeMarkdownOpeningBracket)
    .replace(RE_HTML_TAG, (tag) => `\\${tag}`);
}

function escapeMarkdownOpeningBracket(value: string) {
  return value.replace('[', '\\[');
}
