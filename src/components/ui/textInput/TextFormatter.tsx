import type { Editor } from '@tiptap/core';
import {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';

import type { IAnchorPosition } from '../../../types';

import { formatLinkUrl } from '../../../util/browser/url';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import getKeyFromEvent from '../../../util/getKeyFromEvent';
import stopEvent from '../../../util/stopEvent';
import { isRichEditorBlockquoteActive } from './richEditorFormatting';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';
import useVirtualBackdrop from '../../../hooks/useVirtualBackdrop';

import CalendarModal from '../../common/CalendarModal';
import Button from '../Button';
import TextFormatterInput from './TextFormatterInput';

import styles from './TextFormatter.module.scss';

export type OwnProps = {
  editor?: Editor;
  isOpen: boolean;
  isRichInputExpanded?: boolean;
  anchorPosition?: IAnchorPosition;
  selectedRange?: Range;
  setSelectedRange: (range: Range) => void;
  onClose: () => void;
};

interface ISelectedTextFormats {
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

type SelectedTextFormat = keyof ISelectedTextFormats;
type EditorRange = { from: number; to: number };

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
  isOpen,
  isRichInputExpanded,
  anchorPosition,
  selectedRange,
  setSelectedRange,
  onClose,
}: OwnProps) => {
  const containerRef = useRef<HTMLDivElement>();
  const { shouldRender, transitionClassNames } = useShowTransitionDeprecated(isOpen);
  const [isLinkControlOpen, openLinkControl, closeLinkControl] = useFlag();
  const [isDatePickerOpen, openDatePicker, closeDatePicker] = useFlag();
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedTextFormats, setSelectedTextFormats] = useState<ISelectedTextFormats>({});
  const [selectedDateAt, setSelectedDateAt] = useState(() => roundDateToMinute(new Date()).getTime());

  const lang = useLang();
  const selectedLinkHref = editor ? getSelectedLinkHref(editor) : undefined;

  useEffect(() => (
    isOpen && !isDatePickerOpen ? captureEscKeyListener(onClose) : undefined
  ), [isDatePickerOpen, isOpen, onClose]);
  useVirtualBackdrop(
    isOpen && !isDatePickerOpen,
    containerRef,
    onClose,
    true,
  );

  useEffect(() => {
    if (!isOpen) {
      editor?.commands.setFormatterSelectionHighlight(false);
    }
  }, [editor, isOpen]);

  useEffect(() => {
    if (!isLinkControlOpen) {
      setLinkUrl('');
    }
  }, [isLinkControlOpen]);

  useEffect(() => {
    if (!shouldRender) {
      closeLinkControl();
      closeDatePicker();
      setSelectedTextFormats({});
    }
  }, [closeDatePicker, closeLinkControl, shouldRender]);

  useEffect(() => {
    if (!isOpen || !selectedRange) {
      return;
    }

    const editorRange = editor ? getEditorRangeFromDomRange(editor, selectedRange) : undefined;
    if (editor && editorRange) {
      setSelectedTextFormats(getSelectedEditorTextFormats(editor, editorRange, Boolean(isRichInputExpanded)));
      return;
    }

    setSelectedTextFormats({});
  }, [editor, isOpen, isRichInputExpanded, selectedRange]);

  const restoreSelection = useLastCallback(() => {
    if (!selectedRange) {
      return;
    }

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(selectedRange);
    }
  });

  const updateSelectedRange = useLastCallback(() => {
    const selection = window.getSelection();
    if (selection?.rangeCount) {
      setSelectedRange(selection.getRangeAt(0));
    }
  });

  const restoreEditorSelection = useLastCallback(() => {
    if (!editor || !selectedRange) {
      restoreSelection();
      return undefined;
    }

    const editorRange = getEditorRangeFromDomRange(editor, selectedRange);
    if (!editorRange) {
      restoreSelection();
      return undefined;
    }

    editor.chain().focus().setTextSelection(editorRange).run();
    return editorRange;
  });

  const getSelectedText = useLastCallback(() => {
    if (!selectedRange) {
      return undefined;
    }

    const editorRange = editor ? getEditorRangeFromDomRange(editor, selectedRange) : undefined;
    if (editor && editorRange) {
      return editor.state.doc.textBetween(editorRange.from, editorRange.to, '\n', '\n');
    }

    return selectedRange.toString();
  });

  function getFormatButtonClassName(key: keyof ISelectedTextFormats) {
    if (selectedTextFormats[key]) {
      return 'active';
    }

    if (key === 'strikethrough') {
      if (Object.keys(selectedTextFormats).some(
        (format) => format !== key
          && format !== 'blockquote'
          && Boolean(selectedTextFormats[format as keyof ISelectedTextFormats]),
      )) {
        return 'disabled';
      }
    } else if (key !== 'monospace' && key !== 'blockquote'
      && (selectedTextFormats.monospace || selectedTextFormats.strikethrough)) {
      return 'disabled';
    }

    return undefined;
  }

  const handleToggleEditorMark = useLastCallback((format: SelectedTextFormat) => {
    const editorRange = restoreEditorSelection();
    if (!editor || !editorRange) {
      return false;
    }

    const markName = MARK_NAME_BY_TEXT_FORMAT[format]!;
    const chain = editor.chain().focus().setTextSelection(editorRange);
    if (selectedTextFormats[format]) {
      chain.unsetMark(markName).run();
    } else {
      chain.setMark(markName).run();
    }

    updateSelectedRange();
    setSelectedTextFormats(getSelectedEditorTextFormats(editor, editorRange, Boolean(isRichInputExpanded)));
    return true;
  });

  const handleClearFormatting = useLastCallback(() => {
    const editorRange = restoreEditorSelection();
    if (editor && editorRange) {
      editor.chain().focus().setTextSelection(editorRange).unsetAllMarks({ ignoreClearable: true }).run();
      updateSelectedRange();
      setSelectedTextFormats({});
    }
  });

  const handleSpoilerText = useLastCallback(() => handleToggleEditorMark('spoiler'));
  const handleBoldText = useLastCallback(() => handleToggleEditorMark('bold'));
  const handleItalicText = useLastCallback(() => handleToggleEditorMark('italic'));
  const handleUnderlineText = useLastCallback(() => handleToggleEditorMark('underline'));
  const handleStrikethroughText = useLastCallback(() => handleToggleEditorMark('strikethrough'));

  const handleStructuralText = useLastCallback((format: 'blockquote' | 'code') => {
    const editorRange = restoreEditorSelection();
    if (!editor || !editorRange) {
      return;
    }

    const chain = editor.chain().focus();
    if (format === 'code') {
      chain.toggleSelectionCode().run();
    } else {
      chain.toggleSelectionBlockquote().run();
    }
    updateSelectedRange();
    setSelectedTextFormats(getSelectedEditorTextFormats(
      editor,
      editor.state.selection,
      Boolean(isRichInputExpanded),
    ));
  });

  const handleCodeText = useLastCallback(() => handleStructuralText('code'));
  const handleBlockquoteText = useLastCallback(() => handleStructuralText('blockquote'));
  const handleMarkedText = useLastCallback(() => handleToggleEditorMark('marked'));
  const handleSubscriptText = useLastCallback(() => handleToggleEditorMark('subscript'));
  const handleSuperscriptText = useLastCallback(() => handleToggleEditorMark('superscript'));

  const handleOpenLinkControl = useLastCallback(() => {
    if (!editor) {
      openLinkControl();
      return;
    }

    const commandChain = editor.chain().focus();
    if (selectedLinkHref !== undefined) {
      commandChain.extendMarkRange('link');
    }
    commandChain.setFormatterSelectionHighlight(true).run();
    updateSelectedRange();
    if (selectedLinkHref !== undefined) {
      setLinkUrl(selectedLinkHref);
    }
    openLinkControl();
  });

  const handleCloseLinkControl = useLastCallback(() => {
    restoreEditorSelection();
    editor?.commands.setFormatterSelectionHighlight(false);
    closeLinkControl();
  });

  const handleLinkUrlConfirm = useLastCallback(() => {
    if (!editor) {
      return;
    }

    const commandChain = editor.chain().focus();
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

  const handleDateChange = useLastCallback((date: Date) => {
    setSelectedDateAt(date.getTime());
  });

  const handleFormattedDateConfirm = useLastCallback((date: Date) => {
    const text = getSelectedText();
    const editorRange = restoreEditorSelection();
    if (!text || !selectedRange || !editor || !editorRange) {
      return;
    }

    editor.chain().focus().setTextSelection(editorRange).setMark('date', {
      date: Math.round(date.getTime() / 1000),
    }).run();
    closeDatePicker();
    onClose();
  });

  const handleKeyDown = useLastCallback((e: KeyboardEvent) => {
    if (isDatePickerOpen) {
      return;
    }

    const HANDLERS_BY_KEY: Record<string, AnyToVoidFunction> = {
      k: handleOpenLinkControl,
      b: handleBoldText,
      u: handleUnderlineText,
      i: handleItalicText,
      m: handleCodeText,
      s: handleStrikethroughText,
      p: handleSpoilerText,
    };

    const handler = HANDLERS_BY_KEY[getKeyFromEvent(e)];

    if (
      e.altKey
      || !(e.ctrlKey || e.metaKey)
      || !handler
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    handler();
  });

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!shouldRender) {
    return undefined;
  }

  const className = buildClassName(
    styles.root,
    transitionClassNames,
    isLinkControlOpen && styles.linkControlShown,
  );

  const style = anchorPosition
    ? `left: ${anchorPosition.x}px; top: ${anchorPosition.y}px;--text-formatter-left: ${anchorPosition.x}px;`
    : '';

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      data-text-formatter
      // Prevents focus loss when clicking on the toolbar
      onMouseDown={stopEvent}
    >
      <div className={styles.buttons}>
        <Button
          color="translucent"
          ariaLabel={lang('FormattingSpoilerAria')}
          className={getFormatButtonClassName('spoiler')}
          onClick={handleSpoilerText}
          iconName="eye-crossed"
        />
        <div className={styles.divider} />
        <Button
          color="translucent"
          ariaLabel={lang('FormattingBoldAria')}
          className={getFormatButtonClassName('bold')}
          onClick={handleBoldText}
          iconName="bold"
        />
        <Button
          color="translucent"
          ariaLabel={lang('FormattingItalicAria')}
          className={getFormatButtonClassName('italic')}
          onClick={handleItalicText}
          iconName="italic"
        />
        <Button
          color="translucent"
          ariaLabel={lang('FormattingUnderlineAria')}
          className={getFormatButtonClassName('underline')}
          onClick={handleUnderlineText}
          iconName="underlined"
        />
        <Button
          color="translucent"
          ariaLabel={lang('FormattingStrikethroughAria')}
          className={getFormatButtonClassName('strikethrough')}
          onClick={handleStrikethroughText}
          iconName="strikethrough"
        />
        <Button
          color="translucent"
          ariaLabel={lang('FormattingMonospaceAria')}
          className={getFormatButtonClassName('monospace')}
          onClick={handleCodeText}
          iconName="monospace"
        />
        <Button
          color="translucent"
          ariaLabel={lang('RichEditorBlockquote')}
          className={getFormatButtonClassName('blockquote')}
          onClick={handleBlockquoteText}
          iconName="blockquote"
        />
        <Button
          color="translucent"
          ariaLabel={lang('FormattingClearAria')}
          onClick={handleClearFormatting}
          iconName="clear-formatting"
        />
        <div className={styles.divider} />
        <Button
          color="translucent"
          ariaLabel={lang('FormattingAddDateAria')}
          onClick={handleOpenDatePicker}
          iconName="calendar"
        />
        <Button
          color="translucent"
          ariaLabel={lang(selectedLinkHref !== undefined ? 'EditLink' : 'FormattingAddLinkAria')}
          onClick={handleOpenLinkControl}
          iconName="link"
        />
        {isRichInputExpanded && (
          <>
            <div className={styles.divider} />
            <Button
              color="translucent"
              ariaLabel={lang('FormattingMarkedAria')}
              className={buildClassName(styles.markButton, getFormatButtonClassName('marked'))}
              onClick={handleMarkedText}
              iconName="mark"
              iconHasPremiumBadge
            />
            <Button
              color="translucent"
              ariaLabel={lang('FormattingSubscriptAria')}
              className={getFormatButtonClassName('subscript')}
              onClick={handleSubscriptText}
              iconName="subscript"
              iconHasPremiumBadge
            />
            <Button
              color="translucent"
              ariaLabel={lang('FormattingSuperscriptAria')}
              className={getFormatButtonClassName('superscript')}
              onClick={handleSuperscriptText}
              iconName="superscript"
              iconHasPremiumBadge
            />
          </>
        )}
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
        onDateChange={handleDateChange}
        onSubmit={handleFormattedDateConfirm}
      />
    </div>
  );
};

export default memo(TextFormatter);

function roundDateToMinute(date: Date) {
  const nextDate = new Date(date.getTime());
  nextDate.setSeconds(0);
  nextDate.setMilliseconds(0);
  return nextDate;
}

function getEditorRangeFromDomRange(editor: Editor, range: Range) {
  try {
    const from = editor.view.posAtDOM(range.startContainer, range.startOffset);
    const to = editor.view.posAtDOM(range.endContainer, range.endOffset);

    return {
      from: Math.min(from, to),
      to: Math.max(from, to),
    };
  } catch (err) {
    return undefined;
  }
}

function getSelectedLinkHref(editor: Editor) {
  if (!editor.isActive('link')) {
    return undefined;
  }

  const href = editor.getAttributes('link').href;
  return typeof href === 'string' ? href : undefined;
}

function getSelectedEditorTextFormats(editor: Editor, range: EditorRange, isRichInputExpanded: boolean) {
  const selectedFormats: ISelectedTextFormats = {};
  const { doc, schema } = editor.state;

  TEXT_FORMAT_KEYS.forEach((format) => {
    const markName = MARK_NAME_BY_TEXT_FORMAT[format];
    if (markName) {
      selectedFormats[format] = doc.rangeHasMark(range.from, range.to, schema.marks[markName]);
    }
  });
  doc.nodesBetween(range.from, range.to, (node) => {
    selectedFormats.monospace ||= node.type.name === 'codeBlock';
    return !selectedFormats.monospace;
  });
  selectedFormats.blockquote = isRichEditorBlockquoteActive(editor, range, isRichInputExpanded);

  return selectedFormats;
}
