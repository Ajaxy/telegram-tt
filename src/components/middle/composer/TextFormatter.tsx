import React, {
  FC, memo, useCallback, useEffect, useRef, useState,
} from '../../../lib/teact/teact';

import { IAnchorPosition } from '../../../types';

import { EDITABLE_INPUT_ID } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import useShowTransition from '../../../hooks/useShowTransition';
import useVirtualBackdrop from '../../../hooks/useVirtualBackdrop';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';

import './TextFormatter.scss';

export type OwnProps = {
  isOpen: boolean;
  anchorPosition?: IAnchorPosition;
  selectedRange?: Range;
  onClose: () => void;
};

interface ISelectedTextFormats {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  monospace?: boolean;
}

const TEXT_FORMAT_BY_TAG_NAME: Record<string, keyof ISelectedTextFormats> = {
  B: 'bold',
  STRONG: 'bold',
  I: 'italic',
  EM: 'italic',
  U: 'underline',
  DEL: 'strikethrough',
  CODE: 'monospace',
};
const fragmentEl = document.createElement('div');

const TextFormatter: FC<OwnProps> = ({
  isOpen,
  anchorPosition,
  selectedRange,
  onClose,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const linkUrlInputRef = useRef<HTMLInputElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen);
  const [isLinkControlOpen, openLinkControl, closeLinkControl] = useFlag();
  const [linkUrl, setLinkUrl] = useState('');
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [inputClassName, setInputClassName] = useState<string | undefined>();
  const [selectedTextFormats, setSelectedTextFormats] = useState<ISelectedTextFormats>({});

  useEffect(() => (isOpen ? captureEscKeyListener(onClose) : undefined), [isOpen, onClose]);
  useVirtualBackdrop(
    isOpen,
    containerRef,
    onClose,
  );

  useEffect(() => {
    if (isLinkControlOpen) {
      linkUrlInputRef.current!.focus();
    } else {
      setLinkUrl('');
      setIsEditingLink(false);
    }
  }, [isLinkControlOpen]);

  useEffect(() => {
    if (!shouldRender) {
      closeLinkControl();
      setSelectedTextFormats({});
      setInputClassName(undefined);
    }
  }, [closeLinkControl, shouldRender]);

  useEffect(() => {
    if (!isOpen || !selectedRange) {
      return;
    }

    const selectedFormats: ISelectedTextFormats = {};
    let { parentElement } = selectedRange.commonAncestorContainer;
    while (parentElement && parentElement.id !== EDITABLE_INPUT_ID) {
      const textFormat = TEXT_FORMAT_BY_TAG_NAME[parentElement.tagName];
      if (textFormat) {
        selectedFormats[textFormat] = true;
      }

      parentElement = parentElement.parentElement;
    }

    setSelectedTextFormats(selectedFormats);
  }, [isOpen, selectedRange, openLinkControl]);

  function restoreSelection() {
    if (!selectedRange) {
      return;
    }

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(selectedRange);
    }
  }

  const getSelectedText = useCallback(() => {
    if (!selectedRange) {
      return undefined;
    }
    fragmentEl.innerText = selectedRange.toString();

    return fragmentEl.innerHTML;
  }, [selectedRange]);

  const getSelectedElement = useCallback(() => {
    if (!selectedRange) {
      return undefined;
    }

    return selectedRange.commonAncestorContainer.parentElement;
  }, [selectedRange]);

  function updateInputStyles() {
    const input = linkUrlInputRef.current;
    if (!input) {
      return;
    }

    const { offsetWidth, scrollWidth, scrollLeft } = input;
    if (scrollWidth <= offsetWidth) {
      setInputClassName(undefined);
      return;
    }

    let className = '';
    if (scrollLeft < scrollWidth - offsetWidth) {
      className = 'mask-right';
    }
    if (scrollLeft > 0) {
      className += ' mask-left';
    }

    setInputClassName(className);
  }

  function handleLinkUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLinkUrl(e.target.value);
    updateInputStyles();
  }

  function getFormatButtonClassName(key: keyof ISelectedTextFormats) {
    if (selectedTextFormats[key]) {
      return 'active';
    }

    if (key === 'monospace' || key === 'strikethrough') {
      if (Object.keys(selectedTextFormats).some(
        (fKey) => fKey !== key && !!selectedTextFormats[fKey as keyof ISelectedTextFormats],
      )) {
        return 'disabled';
      }
    } else if (selectedTextFormats.monospace || selectedTextFormats.strikethrough) {
      return 'disabled';
    }

    return undefined;
  }

  const handleBoldText = useCallback(() => {
    setSelectedTextFormats((selectedFormats) => {
      // Somehow re-applying 'bold' command to already bold text doesn't work
      document.execCommand(selectedFormats.bold ? 'removeFormat' : 'bold');
      Object.keys(selectedFormats).forEach((key) => {
        if ((key === 'italic' || key === 'underline') && !!selectedFormats[key]) {
          document.execCommand(key);
        }
      });

      return {
        ...selectedFormats,
        bold: !selectedFormats.bold,
      };
    });
  }, []);

  const handleItalicText = useCallback(() => {
    document.execCommand('italic');
    setSelectedTextFormats((selectedFormats) => ({
      ...selectedFormats,
      italic: !selectedFormats.italic,
    }));
  }, []);

  const handleUnderlineText = useCallback(() => {
    document.execCommand('underline');
    setSelectedTextFormats((selectedFormats) => ({
      ...selectedFormats,
      underline: !selectedFormats.underline,
    }));
  }, []);

  const handleStrikethroughText = useCallback(() => {
    if (selectedTextFormats.strikethrough) {
      const element = getSelectedElement();
      if (
        !selectedRange
        || !element
        || element.tagName !== 'DEL'
        || !element.textContent
      ) {
        return;
      }

      element.replaceWith(element.textContent);
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        strikethrough: false,
      }));

      return;
    }

    const text = getSelectedText();
    document.execCommand('insertHTML', false, `<del>${text}</del>`);
    onClose();
  }, [
    getSelectedElement, getSelectedText, onClose,
    selectedRange, selectedTextFormats.strikethrough,
  ]);

  const handleMonospaceText = useCallback(() => {
    if (selectedTextFormats.monospace) {
      const element = getSelectedElement();
      if (
        !selectedRange
        || !element
        || element.tagName !== 'CODE'
        || !element.textContent
      ) {
        return;
      }

      element.replaceWith(element.textContent);
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        monospace: false,
      }));
      return;
    }

    const text = getSelectedText();
    document.execCommand('insertHTML', false, `<code class="text-entity-code" dir="auto">${text}</code>`);
    onClose();
  }, [
    getSelectedElement, getSelectedText, onClose,
    selectedRange, selectedTextFormats.monospace,
  ]);

  function handleLinkUrlConfirm() {
    const formattedLinkUrl = linkUrl.includes('://') ? linkUrl : `http://${linkUrl}`;

    if (isEditingLink) {
      const element = getSelectedElement();
      if (!element || element.tagName !== 'A') {
        return;
      }

      (element as HTMLAnchorElement).href = formattedLinkUrl;

      onClose();
      return;
    }

    const text = getSelectedText();
    restoreSelection();
    document.execCommand(
      'insertHTML',
      false,
      `<a href=${formattedLinkUrl} class="text-entity-link" dir="auto">${text}</a>`,
    );
    onClose();
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const HANDLERS_BY_KEY_CODE: Record<string, AnyToVoidFunction> = {
      KeyK: openLinkControl,
      KeyB: handleBoldText,
      KeyU: handleUnderlineText,
      KeyI: handleItalicText,
      KeyM: handleMonospaceText,
      KeyS: handleStrikethroughText,
    };

    const handler = HANDLERS_BY_KEY_CODE[e.code];

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
  }, [
    handleBoldText, handleItalicText, handleUnderlineText,
    handleMonospaceText, handleStrikethroughText,
    openLinkControl,
  ]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  const lang = useLang();

  function handleContainerKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && isLinkControlOpen) {
      handleLinkUrlConfirm();
      e.preventDefault();
    }
  }

  if (!shouldRender) {
    return undefined;
  }

  const className = buildClassName(
    'TextFormatter',
    transitionClassNames,
    isLinkControlOpen && 'link-control-shown',
  );

  const linkUrlConfirmClassName = buildClassName(
    'TextFormatter-link-url-confirm',
    !!linkUrl.length && 'shown',
  );

  const style = anchorPosition
    ? `left: ${anchorPosition.x}px; top: ${anchorPosition.y}px;--text-formatter-left: ${anchorPosition.x}px;`
    : '';

  return (
    <div
      ref={containerRef}
      className={className}
      // @ts-ignore Teact feature
      style={style}
      onKeyDown={handleContainerKeyDown}
    >
      <div className="TextFormatter-buttons">
        <Button
          color="translucent"
          ariaLabel="Bold text"
          className={getFormatButtonClassName('bold')}
          onClick={handleBoldText}
        >
          <i className="icon-bold" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Italic text"
          className={getFormatButtonClassName('italic')}
          onClick={handleItalicText}
        >
          <i className="icon-italic" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Underlined text"
          className={getFormatButtonClassName('underline')}
          onClick={handleUnderlineText}
        >
          <i className="icon-underlined" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Strikethrough text"
          className={getFormatButtonClassName('strikethrough')}
          onClick={handleStrikethroughText}
        >
          <i className="icon-strikethrough" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Monospace text"
          className={getFormatButtonClassName('monospace')}
          onClick={handleMonospaceText}
        >
          <i className="icon-monospace" />
        </Button>
        <div className="TextFormatter-divider" />
        <Button color="translucent" ariaLabel={lang('TextFormat.AddLinkTitle')} onClick={openLinkControl}>
          <i className="icon-link" />
        </Button>
      </div>

      <div className="TextFormatter-link-control">
        <div className="TextFormatter-buttons">
          <Button color="translucent" ariaLabel={lang('Cancel')} onClick={closeLinkControl}>
            <i className="icon-arrow-left" />
          </Button>
          <div className="TextFormatter-divider" />

          <div
            className={buildClassName('TextFormatter-link-url-input-wrapper', inputClassName)}
          >
            <input
              ref={linkUrlInputRef}
              className="TextFormatter-link-url-input"
              type="text"
              value={linkUrl}
              placeholder="Enter URL..."
              autoComplete="off"
              inputMode="url"
              dir="auto"
              onChange={handleLinkUrlChange}
              onScroll={updateInputStyles}
            />
          </div>

          <div className={linkUrlConfirmClassName}>
            <div className="TextFormatter-divider" />
            <Button
              color="translucent"
              ariaLabel={lang('Save')}
              className="color-primary"
              onClick={handleLinkUrlConfirm}
            >
              <i className="icon-check" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(TextFormatter);
