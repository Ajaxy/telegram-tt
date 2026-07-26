import { getMarkRange, Mark, mergeAttributes, Node } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';

import type { ApiMessageEntityFormattedDate } from '../../../api/types';
import type { FormattedDateEntityOptions } from '../../dates/formattedDate';
import type { TeactNodeViewComponentProps } from '../TeactNodeViewRenderer';
import { ApiMessageEntityTypes } from '../../../api/types';

import buildClassName from '../../buildClassName';
import { getFormattedDateFormatString } from '../../dates/formattedDate';
import buildDefinedAttributes from './buildDefinedAttributes';

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
    return ['span', mergeAttributes(
      {
        class: buildClassName(styles.textEntityLink, styles.editableDate),
        dir: 'auto',
      },
      buildDefinedAttributes({
        'data-entity-type': ApiMessageEntityTypes.FormattedDate,
        'data-unix': String(HTMLAttributes.date),
      }),
    ), 0];
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

    return ['span', buildDefinedAttributes({
      class: buildClassName(styles.textEntityLink, styles.editableDate),
      'data-entity-type': ApiMessageEntityTypes.FormattedDate,
      'data-unix': String(HTMLAttributes.date),
      'data-format': getFormattedDateFormatString(options),
      contenteditable: 'false',
      draggable: 'false',
      dir: 'auto',
    }), HTMLAttributes.label];
  },

  addNodeView() {
    return TeactNodeViewRenderer(FormattedDateView, {
      as: 'span',
      className: buildClassName(styles.textEntityLink, styles.editableDate),
      selectedOnTextSelection: true,
    });
  },

});

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

  return {
    date,
    label: element.textContent || '',
    relative: format.includes('r') || undefined,
    dayOfWeek: format.includes('w') || undefined,
    shortDate: format.includes('d') || undefined,
    longDate: format.includes('D') || undefined,
    shortTime: format.includes('t') || undefined,
    longTime: format.includes('T') || undefined,
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
