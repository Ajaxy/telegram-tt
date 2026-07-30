import type { Editor } from '@tiptap/core';
import { memo, useEffect, useState } from '../../../lib/teact/teact';

import type { IconName } from '../../../types/icons';
import type { RichEditorFormatterState } from '../../common/tooltips/types';

import { formatLinkUrl } from '../../../util/browser/url';
import buildClassName from '../../../util/buildClassName';
import stopEvent from '../../../util/stopEvent';
import { isRichEditorBlockquoteActive } from './richEditorFormatting';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import CalendarModal from '../../common/CalendarModal';
import Button from '../Button';
import TextFormatterInput from './TextFormatterInput';

import styles from './TextFormatter.module.scss';

type EditorRange = { from: number; to: number };

export type OwnProps = {
  editor: Editor;
  range: EditorRange;
  capabilities: 'basic' | 'full';
  controlRequest?: RichEditorFormatterState['controlRequest'];
  isRichInputExpanded?: boolean;
  onClose: NoneToVoidFunction;
  onDismissalChange: (isBlocked: boolean) => void;
};

interface SelectedTextFormats {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  monospace?: boolean;
  spoiler?: boolean;
  marked?: boolean;
  subscript?: boolean;
  superscript?: boolean;
  blockquote?: boolean;
}

type SelectedTextFormat = keyof SelectedTextFormats;

const TEXT_FORMAT_KEYS: SelectedTextFormat[] = [
  'bold', 'italic', 'underline', 'strikethrough', 'monospace', 'spoiler', 'marked', 'subscript', 'superscript',
  'blockquote',
];
const MARK_NAME_BY_TEXT_FORMAT: Partial<Record<SelectedTextFormat, string>> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strikethrough: 'strike',
  monospace: 'code',
  spoiler: 'spoiler',
  marked: 'marked',
  subscript: 'subscript',
  superscript: 'superscript',
};

const TextFormatter = ({
  editor,
  range,
  capabilities,
  controlRequest,
  isRichInputExpanded,
  onClose,
  onDismissalChange,
}: OwnProps) => {
  const [isLinkControlOpen, openLinkControl, closeLinkControl] = useFlag();
  const [isDatePickerOpen, openDatePicker, closeDatePicker] = useFlag();
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedDateAt, setSelectedDateAt] = useState(() => roundDateToMinute(new Date()).getTime());

  const lang = useLang();
  const {
    formats: selectedTextFormats,
    hasFormatting: hasSelectedTextFormatting,
  } = getSelectedEditorTextState(editor, range, Boolean(isRichInputExpanded));
  const selectedLinkHref = getSelectedLinkHref(editor, range);

  useEffect(() => {
    if (!isLinkControlOpen) {
      setLinkUrl('');
    }
  }, [isLinkControlOpen]);

  useEffect(() => {
    return () => {
      if (!editor.isDestroyed) {
        editor.commands.setFormatterSelectionHighlight(false);
      }
    };
  }, [editor]);

  useEffect(() => {
    onDismissalChange(isDatePickerOpen);
    return () => onDismissalChange(false);
  }, [isDatePickerOpen, onDismissalChange]);

  const restoreEditorSelection = useLastCallback(() => {
    if (editor.isDestroyed) {
      return false;
    }

    return editor.chain().focus().setTextSelection(range).run();
  });

  function getFormatButtonClassName(key: SelectedTextFormat) {
    return selectedTextFormats[key] ? 'active' : undefined;
  }

  function isFormatButtonDisabled(key: SelectedTextFormat) {
    if (selectedTextFormats[key]) {
      return false;
    }
    if (key === 'subscript') {
      return Boolean(selectedTextFormats.superscript);
    }
    if (key === 'superscript') {
      return Boolean(selectedTextFormats.subscript);
    }

    return key !== 'monospace'
      && key !== 'blockquote'
      && Boolean(selectedTextFormats.monospace);
  }

  const handleToggleEditorMark = useLastCallback((format: SelectedTextFormat) => {
    if (!restoreEditorSelection()) {
      return;
    }

    const markName = MARK_NAME_BY_TEXT_FORMAT[format]!;
    const chain = editor.chain();
    if (selectedTextFormats[format]) {
      chain.unsetMark(markName).run();
    } else {
      chain.setMark(markName).run();
    }
  });

  const handleClearFormatting = useLastCallback(() => {
    if (!restoreEditorSelection()) {
      return;
    }

    editor.chain().unsetAllMarks({ ignoreClearable: true }).run();
  });

  const handleStructuralText = useLastCallback((format: 'blockquote' | 'code') => {
    if (!restoreEditorSelection()) {
      return;
    }

    const chain = editor.chain();
    if (format === 'code') {
      chain.toggleSelectionCode().run();
    } else {
      chain.toggleSelectionBlockquote().run();
    }
  });

  const handleOpenLinkControl = useLastCallback(() => {
    if (!restoreEditorSelection()) {
      return;
    }

    const commandChain = editor.chain();
    if (selectedLinkHref !== undefined) {
      commandChain.extendMarkRange('link');
    }
    commandChain.setFormatterSelectionHighlight(true).run();
    if (selectedLinkHref !== undefined) {
      setLinkUrl(selectedLinkHref);
    }
    openLinkControl();
  });

  const handleCloseLinkControl = useLastCallback(() => {
    if (restoreEditorSelection()) {
      editor.commands.setFormatterSelectionHighlight(false);
    }
    closeLinkControl();
  });

  const handleLinkUrlConfirm = useLastCallback(() => {
    if (!restoreEditorSelection()) {
      return;
    }

    const commandChain = editor.chain();
    if (!linkUrl.trim()) {
      commandChain.unsetLink().run();
    } else {
      commandChain.setLink({ href: formatLinkUrl(linkUrl) }).run();
    }
    onClose();
  });

  const handleOpenDatePicker = useLastCallback(() => {
    closeLinkControl();
    setSelectedDateAt(roundDateToMinute(new Date()).getTime());
    openDatePicker();
  });

  const handleFormattedDateConfirm = useLastCallback((date: Date) => {
    const text = editor.state.doc.textBetween(range.from, range.to, '\n', '\n');
    if (!text || !restoreEditorSelection()) {
      return;
    }

    editor.chain().setMark('date', {
      date: Math.round(date.getTime() / 1000),
    }).run();
    closeDatePicker();
    onClose();
  });

  useEffect(() => {
    if (controlRequest?.control === 'link') {
      handleOpenLinkControl();
    } else if (controlRequest?.control === 'date') {
      handleOpenDatePicker();
    }
  }, [controlRequest, handleOpenDatePicker, handleOpenLinkControl]);

  const className = buildClassName(styles.root, isLinkControlOpen && styles.linkControlShown);

  return (
    <div
      className={className}
      data-text-formatter
      role="toolbar"
      onMouseDown={stopEvent}
    >
      <div className={buildClassName(styles.buttons, 'no-scrollbar')}>
        <FormatButton
          ariaLabel={lang('RichEditorBlockquote')}
          className={getFormatButtonClassName('blockquote')}
          iconName="blockquote"
          onClick={() => handleStructuralText('blockquote')}
        />
        <FormatButton
          ariaLabel={lang('FormattingSpoilerAria')}
          className={getFormatButtonClassName('spoiler')}
          iconName="spoiler-text"
          isDisabled={isFormatButtonDisabled('spoiler')}
          onClick={() => handleToggleEditorMark('spoiler')}
        />
        <div className={styles.divider} />
        <FormatButton
          ariaLabel={lang('FormattingBoldAria')}
          className={getFormatButtonClassName('bold')}
          iconName="bold"
          isDisabled={isFormatButtonDisabled('bold')}
          onClick={() => handleToggleEditorMark('bold')}
        />
        <FormatButton
          ariaLabel={lang('FormattingItalicAria')}
          className={getFormatButtonClassName('italic')}
          iconName="italic"
          isDisabled={isFormatButtonDisabled('italic')}
          onClick={() => handleToggleEditorMark('italic')}
        />
        <FormatButton
          ariaLabel={lang('FormattingUnderlineAria')}
          className={getFormatButtonClassName('underline')}
          iconName="underlined"
          isDisabled={isFormatButtonDisabled('underline')}
          onClick={() => handleToggleEditorMark('underline')}
        />
        <FormatButton
          ariaLabel={lang('FormattingStrikethroughAria')}
          className={getFormatButtonClassName('strikethrough')}
          iconName="strikethrough"
          isDisabled={isFormatButtonDisabled('strikethrough')}
          onClick={() => handleToggleEditorMark('strikethrough')}
        />
        <FormatButton
          ariaLabel={lang('FormattingMonospaceAria')}
          className={getFormatButtonClassName('monospace')}
          iconName="monospace"
          onClick={() => handleStructuralText('code')}
        />
        <div className={styles.divider} />
        <FormatButton
          ariaLabel={lang('FormattingAddDateAria')}
          iconName="calendar"
          onClick={handleOpenDatePicker}
        />
        <FormatButton
          ariaLabel={lang(selectedLinkHref !== undefined ? 'EditLink' : 'FormattingAddLinkAria')}
          iconName="link"
          onClick={handleOpenLinkControl}
        />
        {capabilities === 'full' && isRichInputExpanded && (
          <>
            <div className={styles.divider} />
            <FormatButton
              ariaLabel={lang('FormattingMarkedAria')}
              className={buildClassName(styles.markButton, getFormatButtonClassName('marked'))}
              iconName="mark"
              hasPremiumBadge
              isDisabled={isFormatButtonDisabled('marked')}
              onClick={() => handleToggleEditorMark('marked')}
            />
            <FormatButton
              ariaLabel={lang('FormattingSubscriptAria')}
              className={getFormatButtonClassName('subscript')}
              iconName="subscript"
              hasPremiumBadge
              isDisabled={isFormatButtonDisabled('subscript')}
              onClick={() => handleToggleEditorMark('subscript')}
            />
            <FormatButton
              ariaLabel={lang('FormattingSuperscriptAria')}
              className={getFormatButtonClassName('superscript')}
              iconName="superscript"
              hasPremiumBadge
              isDisabled={isFormatButtonDisabled('superscript')}
              onClick={() => handleToggleEditorMark('superscript')}
            />
          </>
        )}
        <div className={styles.divider} />
        <FormatButton
          ariaLabel={lang('FormattingClearAria')}
          iconName="clear-formatting"
          isDisabled={!hasSelectedTextFormatting}
          onClick={handleClearFormatting}
        />
      </div>
      <div
        className={buildClassName(styles.linkControl, styles.inputPopup)}
        aria-hidden={!isLinkControlOpen}
        inert={!isLinkControlOpen}
      >
        <TextFormatterInput
          value={linkUrl}
          placeholder={lang('FormattingEnterUrl')}
          ariaLabel={lang('FormattingEnterUrl')}
          isActive={isLinkControlOpen}
          leadingButtonIconName="arrow-left"
          leadingButtonAriaLabel={lang('Cancel')}
          canSubmitEmpty={selectedLinkHref !== undefined}
          inputMode="url"
          dir="auto"
          onChange={setLinkUrl}
          onSubmit={handleLinkUrlConfirm}
          onDeleteEmpty={handleLinkUrlConfirm}
          onLeadingButtonClick={handleCloseLinkControl}
        />
      </div>
      <CalendarModal
        isOpen={isDatePickerOpen}
        selectedAt={selectedDateAt}
        withTimePicker
        submitButtonLabel={lang('Save')}
        onClose={closeDatePicker}
        onDateChange={(date) => setSelectedDateAt(date.getTime())}
        onSubmit={handleFormattedDateConfirm}
      />
    </div>
  );
};

export default memo(TextFormatter);

function FormatButton({
  ariaLabel,
  className,
  iconName,
  hasPremiumBadge,
  isDisabled,
  onClick,
}: {
  ariaLabel: string;
  className?: string;
  iconName: IconName;
  hasPremiumBadge?: boolean;
  isDisabled?: boolean;
  onClick: NoneToVoidFunction;
}) {
  return (
    <Button
      color="translucent"
      ariaLabel={ariaLabel}
      className={className}
      iconName={iconName}
      iconHasPremiumBadge={hasPremiumBadge}
      disabled={isDisabled}
      onClick={onClick}
    />
  );
}

function roundDateToMinute(date: Date) {
  const nextDate = new Date(date.getTime());
  nextDate.setSeconds(0);
  nextDate.setMilliseconds(0);
  return nextDate;
}

function getSelectedLinkHref(editor: Editor, range: EditorRange) {
  const linkMark = editor.schema.marks.link;
  let href: string | undefined;
  editor.state.doc.nodesBetween(range.from, range.to, (node) => {
    const mark = linkMark && linkMark.isInSet(node.marks);
    if (mark && typeof mark.attrs.href === 'string') {
      href = mark.attrs.href;
    }
  });
  return href;
}

function getSelectedEditorTextState(editor: Editor, range: EditorRange, isRichInputExpanded: boolean) {
  const selectedFormats: SelectedTextFormats = {};
  const { doc, schema } = editor.state;
  let hasFormatting = false;

  TEXT_FORMAT_KEYS.forEach((format) => {
    const markName = MARK_NAME_BY_TEXT_FORMAT[format];
    if (markName && schema.marks[markName]) {
      selectedFormats[format] = doc.rangeHasMark(range.from, range.to, schema.marks[markName]);
    }
  });
  doc.nodesBetween(range.from, range.to, (node) => {
    hasFormatting ||= Boolean(node.marks.length);
    selectedFormats.monospace ||= node.type.name === 'codeBlock';
  });
  selectedFormats.blockquote = isRichEditorBlockquoteActive(editor, range, isRichInputExpanded);

  return {
    formats: selectedFormats,
    hasFormatting,
  };
}
