import { useEffect, useRef, useState } from '../../../../lib/teact/teact';

import type { IAnchorPosition } from '../../../../types';

import buildClassName from '../../../../util/buildClassName';
import { getPrettyCodeLanguageName, SUPPORTED_CODE_LANGUAGES } from '../../../../util/codeLanguages';
import {
  ensureCodeLanguage,
  requestCodeBlockHighlightRefresh,
} from '../../../../util/highlightCode';
import { fastRaf } from '../../../../util/schedulers';
import {
  type TeactNodeViewComponentProps,
} from '../../../../util/tiptap';

import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Icon from '../../../common/icons/Icon';
import Menu from '../../../ui/Menu';
import MenuItem from '../../../ui/MenuItem';

import styles from './EditableCodeBlock.module.scss';

const CODE_BLOCK_TEXT_SEPARATOR = '\n';

const EditableCodeBlock = ({
  editor,
  node,
  HTMLAttributes,
  getPos,
  contentDOMElement,
}: TeactNodeViewComponentProps) => {
  const triggerRef = useRef<HTMLButtonElement>();
  const menuRef = useRef<HTMLDivElement>();
  const [isMenuOpen, openMenu, closeMenu] = useFlag();
  const [menuAnchor, setMenuAnchor] = useState<IAnchorPosition | undefined>();
  const lang = useLang();

  const language = typeof node.attrs.language === 'string' ? node.attrs.language : undefined;
  const languageLabel = language ? getPrettyCodeLanguageName(language) : lang('RichEditorCodeLanguageAuto');
  const isCodeBlockEmpty = !node.textContent;
  const codeBlockClassName = buildClassName(
    styles.codeBlock,
    typeof HTMLAttributes.class === 'string' && HTMLAttributes.class,
  );

  function handleCodeBlockWrapperRef(element?: HTMLDivElement) {
    if (!element || !contentDOMElement) {
      return;
    }

    contentDOMElement.className = codeBlockClassName;
    if (contentDOMElement.parentElement !== element) {
      element.prepend(contentDOMElement);
    }
  }

  useEffect(() => {
    if (language) {
      void ensureCodeLanguage(language);
    }
  }, [language]);

  const handleTriggerMouseDown = useLastCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
  });

  const handleTriggerClick = useLastCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    setMenuAnchor({
      x: rect.left,
      y: rect.bottom,
      width: rect.width,
      height: rect.height,
    });
    openMenu();
  });

  const handleCloseMenu = useLastCallback(() => {
    closeMenu();
  });

  const handleSetLanguage = useLastCallback((newLanguage?: string) => {
    closeMenu();

    if ((newLanguage || undefined) === language) {
      return;
    }

    fastRaf(() => {
      void updateCodeBlockLanguage(newLanguage);
    });
  });

  const updateCodeBlockLanguage = useLastCallback(async (newLanguage?: string) => {
    const pos = getPos();
    if (typeof pos !== 'number') {
      editor.commands.focus();
      return;
    }

    const didUpdate = editor.commands.command(({ tr, state }) => {
      const currentNode = tr.doc.nodeAt(pos);
      if (!currentNode || currentNode.type.name !== node.type.name) {
        return false;
      }

      const attrs = { ...currentNode.attrs, language: newLanguage || undefined };

      if (!currentNode.type.validContent(currentNode.content)) {
        const plainText = currentNode.textBetween(
          0,
          currentNode.content.size,
          CODE_BLOCK_TEXT_SEPARATOR,
          CODE_BLOCK_TEXT_SEPARATOR,
        );
        const content = plainText ? state.schema.text(plainText) : undefined;
        tr.replaceWith(pos + 1, pos + currentNode.nodeSize - 1, content || []);
      }

      tr.setNodeMarkup(pos, undefined, attrs);
      return true;
    });

    if (!didUpdate) {
      editor.commands.focus();
      return;
    }

    if (newLanguage) {
      await ensureCodeLanguage(newLanguage);
    }

    requestCodeBlockHighlightRefresh();
    editor.commands.focus();
  });

  const getTriggerElement = useLastCallback(() => triggerRef.current);
  const getRootElement = useLastCallback(() => document.body);
  const getMenuElement = useLastCallback(() => menuRef.current);
  const getMenuLayout = useLastCallback(() => ({ withPortal: true }));

  return (
    <div className={styles.root}>
      <button
        ref={triggerRef}
        type="button"
        className={buildClassName(styles.languageButton, 'no-selection')}
        contentEditable={false}
        tabIndex={-1}
        aria-label={lang('Language')}
        onMouseDown={handleTriggerMouseDown}
        onClick={handleTriggerClick}
      >
        {languageLabel}
        <Icon name="dropdown-arrows" className={styles.languageIcon} />
      </button>
      <div ref={handleCodeBlockWrapperRef} className={styles.codeBlockWrapper}>
        {isCodeBlockEmpty && (
          <div
            className={styles.placeholder}
            contentEditable={false}
            aria-hidden
          >
            {lang('RichEditorBlockPlaceholder')}
          </div>
        )}
      </div>
      <Menu
        ref={menuRef}
        isOpen={isMenuOpen}
        anchor={menuAnchor}
        ariaLabel={lang('Language')}
        getTriggerElement={getTriggerElement}
        getRootElement={getRootElement}
        getMenuElement={getMenuElement}
        getLayout={getMenuLayout}
        bubbleClassName={styles.languageMenu}
        autoClose
        withPortal
        onClose={handleCloseMenu}
      >
        <div className={buildClassName(styles.languageItems, 'custom-scroll')}>
          <MenuItem
            customIcon={language ? <Icon name="placeholder" /> : <Icon name="message-succeeded" />}
            withPreventDefaultOnMouseDown
            onClick={() => handleSetLanguage(undefined)}
          >
            {lang('RichEditorCodeLanguageAuto')}
          </MenuItem>
          {SUPPORTED_CODE_LANGUAGES.map((langCode) => (
            <MenuItem
              key={langCode}
              customIcon={language === langCode ? <Icon name="message-succeeded" /> : <Icon name="placeholder" />}
              withPreventDefaultOnMouseDown
              onClick={() => handleSetLanguage(langCode)}
            >
              {getPrettyCodeLanguageName(langCode)}
            </MenuItem>
          ))}
        </div>
      </Menu>
    </div>
  );
};

export default EditableCodeBlock;
