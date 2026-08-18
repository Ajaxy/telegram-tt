import {
  getMarkRange, Mark, mergeAttributes, Node,
} from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';

import type { ApiMessageEntityFormattedDate } from '../../../api/types';
import type { FormattedDateEntityOptions } from '../../dates/formattedDate';
import type { TeactNodeViewComponentProps } from '../TeactNodeViewRenderer';
import { ApiMessageEntityTypes } from '../../../api/types';

import { MAX_INT_32 } from '../../../config';
import buildClassName from '../../buildClassName';
import { getFormattedDateFormatString } from '../../dates/formattedDate';
import {
  buildRichMarkdownNodeInputRule,
  buildRichMarkdownTokenizer,
  escapeRichMarkdownLabel,
  parseRichMarkdownNode,
  type RichMarkdownLink,
} from '../richMarkdown';

import useLastCallback from '../../../hooks/useLastCallback';

import FormattedDate from '../../../components/common/FormattedDate';
import TeactNodeViewRenderer from '../TeactNodeViewRenderer';

import styles from '../styling.module.scss';

export type RichEditorDateClickTarget = {
  type: 'date';
  date: number;
  range: RichEditorDateRange;
} | {
  type: 'formattedDate';
  date: number;
  options: FormattedDateEntityOptions;
  range: RichEditorDateRange;
};

type RichEditorDateRange = {
  from: number;
  to: number;
};

type DateExtensionOptions = {
  onClick?: (target: RichEditorDateClickTarget) => void;
};

const DATE_ENTITY_SELECTOR = `[data-entity-type="${ApiMessageEntityTypes.FormattedDate}"]`;
const RE_FORMATTED_DATE_FORMAT = /^(?:r|w?[dD]?[tT]?)$/;

export const DateMark = Mark.create<DateExtensionOptions>({
  name: 'date',
  inclusive: false,

  addOptions() {
    return { onClick: undefined };
  },

  addAttributes() {
    return {
      date: {
        default: undefined,
        parseHTML: (element: HTMLElement) => parseDate(element),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'tg-time[unix]', getAttrs: (element) => buildDateMarkAttrs(element) },
      { tag: DATE_ENTITY_SELECTOR, getAttrs: (element) => buildDateMarkAttrs(element) },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['tg-time', mergeAttributes(
      {
        class: buildClassName(styles.textEntityLink, styles.editableDate),
        dir: 'auto',
      },
      {
        unix: String(HTMLAttributes.date),
      },
    ), 0];
  },

  renderMarkdown(node, helpers) {
    const label = escapeRichMarkdownLabel(helpers.renderChildren(node));
    return `![${label}](tg://time?unix=${node.attrs?.date})`;
  },

  addProseMirrorPlugins() {
    const { onClick } = this.options;

    return [new Plugin({
      props: {
        handleClick: (view, position) => {
          if (!onClick) {
            return false;
          }

          const markType = view.state.schema.marks[this.name];
          const $position = view.state.doc.resolve(position);
          const mark = $position.marks().find(({ type }) => type === markType)
            || view.state.doc.nodeAt(position)?.marks.find(({ type }) => type === markType);
          if (!mark) {
            return false;
          }

          const date = parseDate(mark.attrs.date);
          const range = getMarkRange($position, markType, mark.attrs);
          if (date === undefined || !range) {
            return false;
          }

          onClick({ type: 'date', date, range });
          return true;
        },
      },
    })];
  },
});

export const FormattedDateNode = Node.create<DateExtensionOptions>({
  name: 'formattedDate',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  markdownTokenName: 'formattedDate',

  markdownTokenizer: buildRichMarkdownTokenizer('formattedDate', true, buildFormattedDateMarkdownAttrs),

  parseMarkdown(token, helpers) {
    return parseRichMarkdownNode(token, helpers, true, 'formattedDate', buildFormattedDateMarkdownAttrs);
  },

  addInputRules() {
    return [buildRichMarkdownNodeInputRule(this.type, buildFormattedDateMarkdownAttrs)];
  },

  addOptions() {
    return { onClick: undefined };
  },

  addAttributes() {
    return {
      date: {
        default: undefined,
        parseHTML: (element: HTMLElement) => parseDate(element),
      },
      label: {
        default: '',
        parseHTML: (element: HTMLElement) => element.textContent || '',
      },
      relative: { default: undefined },
      dayOfWeek: { default: undefined },
      shortDate: { default: undefined },
      longDate: { default: undefined },
      shortTime: { default: undefined },
      longTime: { default: undefined },
    };
  },

  parseHTML() {
    return [
      { tag: 'tg-time[unix]', getAttrs: (element) => buildFormattedDateNodeAttrs(element) },
      { tag: DATE_ENTITY_SELECTOR, getAttrs: (element) => buildFormattedDateNodeAttrs(element) },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const options = buildFormattedDateOptions(HTMLAttributes);

    return ['tg-time', {
      unix: String(HTMLAttributes.date),
      format: getFormattedDateFormatString(options),
    }, HTMLAttributes.label];
  },

  renderText({ node }) {
    return node.attrs.label;
  },

  renderMarkdown(node) {
    const format = getFormattedDateFormatString(node.attrs || {});
    return `![${escapeRichMarkdownLabel(node.attrs?.label)}](tg://time?unix=${node.attrs?.date}&format=${format})`;
  },

  addNodeView() {
    return TeactNodeViewRenderer(FormattedDateView, {
      as: 'span',
      className: buildClassName(styles.textEntityLink, styles.editableDate),
      selectedOnTextSelection: true,
    });
  },

});

export function buildFormattedDateMarkdownAttrs(markdown: RichMarkdownLink) {
  if (!markdown.isImage || !markdown.label.trim()
    || markdown.url.protocol !== 'tg:' || markdown.url.host !== 'time') {
    return undefined;
  }

  const rawDate = markdown.url.searchParams.get('unix') || undefined;
  const format = markdown.url.searchParams.get('format') || '';
  const date = Number(rawDate);
  if (
    !rawDate
    || !Number.isSafeInteger(date)
    || date <= 0
    || date > MAX_INT_32
    || !RE_FORMATTED_DATE_FORMAT.test(format)
  ) {
    return undefined;
  }

  return buildFormattedDateAttrs(date, markdown.label, format);
}

function FormattedDateView({ node, extension, getPos }: TeactNodeViewComponentProps) {
  const date = parseDate(node.attrs.date);
  const label = typeof node.attrs.label === 'string' ? node.attrs.label : '';
  const options = buildFormattedDateOptions(node.attrs);

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    const position = getPos();
    const { onClick } = extension.options as DateExtensionOptions;
    if (date === undefined || typeof position !== 'number' || !onClick) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    onClick({
      type: 'formattedDate',
      date,
      options,
      range: { from: position, to: position + node.nodeSize },
    });
  });

  const entity: ApiMessageEntityFormattedDate | undefined = date === undefined ? undefined : {
    type: ApiMessageEntityTypes.FormattedDate,
    offset: 0,
    length: label.length,
    date,
    ...options,
  };

  return (
    <span contentEditable={false} onClick={handleClick}>
      {entity ? <FormattedDate entity={entity} asPreview>{label}</FormattedDate> : label}
    </span>
  );
}

function buildDateMarkAttrs(element: HTMLElement | string) {
  if (!(element instanceof HTMLElement) || getDateFormat(element)) {
    return false;
  }

  const date = parseDate(element);
  return date === undefined ? false : { date };
}

function buildFormattedDateNodeAttrs(element: HTMLElement | string) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const date = parseDate(element);
  const format = getDateFormat(element);
  if (date === undefined || !format) {
    return false;
  }

  return buildFormattedDateAttrs(date, element.textContent || '', format);
}

function buildFormattedDateAttrs(date: number, label: string, format: string) {
  return {
    date,
    label,
    ...buildFormattedDateOptions({
      relative: format.includes('r'),
      dayOfWeek: format.includes('w'),
      shortDate: format.includes('d'),
      longDate: format.includes('D'),
      shortTime: format.includes('t'),
      longTime: format.includes('T'),
    }),
  };
}

function buildFormattedDateOptions(attrs: AnyLiteral): FormattedDateEntityOptions {
  return {
    relative: attrs.relative === true ? true : undefined,
    dayOfWeek: attrs.dayOfWeek === true ? true : undefined,
    shortDate: attrs.shortDate === true ? true : undefined,
    longDate: attrs.longDate === true ? true : undefined,
    shortTime: attrs.shortTime === true ? true : undefined,
    longTime: attrs.longTime === true ? true : undefined,
  };
}

function parseDate(value: unknown) {
  const rawValue = value instanceof HTMLElement
    ? value.getAttribute('unix') || value.dataset.unix
    : value;
  const date = typeof rawValue === 'number' ? rawValue : Number(rawValue);

  return Number.isFinite(date) ? date : undefined;
}

function getDateFormat(element: HTMLElement) {
  return element.getAttribute('format') || element.dataset.format || undefined;
}
