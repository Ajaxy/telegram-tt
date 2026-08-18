import type { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import {
  memo, useEffect, useState,
} from '../../../lib/teact/teact';

import type {
  RichEditorListState, RichHeadingLevel, RichListType, RichOrderedListType,
} from './helpers/richEditor';

import { areDeepEqual } from '../../../util/areDeepEqual';
import { formatLinkUrl } from '../../../util/browser/url';
import {
  FOOTER_NODE_NAME,
  MATH_BLOCK_NODE_NAME,
  MATH_INLINE_NODE_NAME,
} from '../../../util/tiptap/constants';
import {
  checkCanInsertRichEditorList,
  getCurrentRichEditorList,
  insertRichEditorList,
  RICH_HEADING_LEVELS,
  RICH_ORDERED_LIST_TYPES,
  setCurrentRichEditorListType,
  setCurrentRichEditorOrderedListType,
  toggleCurrentRichEditorListChecklist,
  toggleCurrentRichEditorOrderedListReversed,
} from './helpers/richEditor';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import DropdownMenu from '../../ui/DropdownMenu';
import MenuItem from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';
import NestedMenuItem from '../../ui/NestedMenuItem';
import RichEditorLinkModal from './RichEditorLinkModal';

type OwnProps = {
  editor?: Editor;
  isEnabled?: boolean;
};

type RichEditorToolbarAvailability = {
  canToggleHeadingByLevel: Record<RichHeadingLevel, boolean>;
  canToggleFooter: boolean;
  canSetBlockquote: boolean;
  canTogglePullquote: boolean;
  canSetDetails: boolean;
  canSetHorizontalRule: boolean;
  canInsertBulletList: boolean;
  canInsertOrderedList: boolean;
  currentList?: RichEditorListState;
  canInsertTable: boolean;
  canInsertLink: boolean;
  canToggleCodeBlock: boolean;
  canInsertEquation: boolean;
};

type MathNodeType = typeof MATH_BLOCK_NODE_NAME | typeof MATH_INLINE_NODE_NAME;

const DEFAULT_TABLE_OPTIONS = {
  rows: 2,
  cols: 2,
  withHeaderRow: false,
};
const CODE_BLOCK_NODE_TYPE = 'codeBlock';
const PARAGRAPH_NODE_TYPE = 'paragraph';
const INSERTED_BLOCK_NODE_TYPES = {
  details: 'details',
  divider: 'horizontalRule',
  table: 'table',
} as const;
const ORDERED_LIST_TYPE_LABELS = {
  1: 'RichEditorListNumberingDecimal',
  a: 'RichEditorListNumberingLowercaseLetters',
  A: 'RichEditorListNumberingUppercaseLetters',
  i: 'RichEditorListNumberingLowercaseRoman',
  I: 'RichEditorListNumberingUppercaseRoman',
} as const;
const LIST_INSERT_OPTIONS = [
  {
    type: 'bulletList', icon: 'bullet-list', label: 'RichEditorBulletList', availability: 'canInsertBulletList',
    isChecklist: undefined,
  },
  {
    type: 'orderedList', icon: 'numbered-list', label: 'RichEditorOrderedList', availability: 'canInsertOrderedList',
    isChecklist: undefined,
  },
  {
    type: 'bulletList', icon: 'task-list', label: 'RichEditorChecklist', availability: 'canInsertBulletList',
    isChecklist: true,
  },
] as const;
const LIST_TYPE_OPTIONS = LIST_INSERT_OPTIONS.filter(({ isChecklist }) => !isChecklist);
const EMPTY_BLOCK_EQUATION_CONTENT = buildEquationContent(MATH_BLOCK_NODE_NAME, '');
const EMPTY_INLINE_EQUATION_CONTENT = buildEquationContent(MATH_INLINE_NODE_NAME, '');
const EMPTY_TOOLBAR_AVAILABILITY: RichEditorToolbarAvailability = {
  canToggleHeadingByLevel: {
    1: false,
    2: false,
    3: false,
    4: false,
    5: false,
    6: false,
  },
  canToggleFooter: false,
  canSetBlockquote: false,
  canTogglePullquote: false,
  canSetDetails: false,
  canSetHorizontalRule: false,
  canInsertBulletList: false,
  canInsertOrderedList: false,
  currentList: undefined,
  canInsertTable: false,
  canInsertLink: false,
  canToggleCodeBlock: false,
  canInsertEquation: false,
};

const RichEditorToolbar = ({ editor, isEnabled }: OwnProps) => {
  const [availability, setAvailability] = useState(EMPTY_TOOLBAR_AVAILABILITY);
  const [isLinkModalOpen, openLinkModal, closeLinkModal] = useFlag();
  const lang = useLang();

  useEffect(() => {
    if (!editor || !isEnabled) {
      setAvailability(EMPTY_TOOLBAR_AVAILABILITY);
      return undefined;
    }

    const activeEditor = editor;
    let isDestroyed = false;
    let isUpdateScheduled = false;

    function updateAvailability() {
      const nextAvailability = buildToolbarAvailability(activeEditor);
      setAvailability((currentAvailability) => (
        areDeepEqual(currentAvailability, nextAvailability) ? currentAvailability : nextAvailability
      ));
    }

    function scheduleAvailabilityUpdate() {
      if (isUpdateScheduled) {
        return;
      }

      isUpdateScheduled = true;
      queueMicrotask(() => {
        isUpdateScheduled = false;
        if (!isDestroyed) {
          updateAvailability();
        }
      });
    }

    updateAvailability();
    activeEditor.on('transaction', scheduleAvailabilityUpdate);

    return () => {
      isDestroyed = true;
      activeEditor.off('transaction', scheduleAvailabilityUpdate);
    };
  }, [editor, isEnabled]);

  const handleToggleHeading = useLastCallback((level: RichHeadingLevel) => {
    if (!editor || !checkCanUseBlockOptions(editor)) {
      return;
    }

    editor.chain().focus().toggleHeading({ level }).run();
  });

  const handleSetBlockquote = useLastCallback(() => {
    if (!editor || !checkCanUseBlockOptions(editor)) {
      return;
    }

    editor.chain().focus().setBlockquote().run();
  });

  const handleToggleFooter = useLastCallback(() => {
    if (!editor || !checkCanUseBlockOptions(editor)) {
      return;
    }

    editor.chain().focus().toggleNode(FOOTER_NODE_NAME, PARAGRAPH_NODE_TYPE).run();
  });

  const handleTogglePullquote = useLastCallback(() => {
    if (!editor || !checkCanUseBlockOptions(editor)) {
      return;
    }

    editor.chain().focus().togglePullquote().run();
  });

  const handleSetDetails = useLastCallback(() => {
    if (!editor || !checkCanUseBlockOptions(editor)
      || !checkCanSetBlockAtSelection(editor, INSERTED_BLOCK_NODE_TYPES.details)) {
      return;
    }

    editor.chain().focus().setDetails().run();
  });

  const handleSetHorizontalRule = useLastCallback(() => {
    if (!editor || !checkCanUseBlockOptions(editor)
      || !checkCanInsertBlockAtSelection(editor, INSERTED_BLOCK_NODE_TYPES.divider)) {
      return;
    }

    editor.chain().focus().setHorizontalRule().run();
  });

  const handleInsertList = useLastCallback((type: RichListType, isChecklist?: boolean) => {
    if (!editor || !checkCanUseBlockOptions(editor)) {
      return;
    }

    insertRichEditorList(editor, type, isChecklist);
  });

  const handleSetCurrentListType = useLastCallback((type: RichListType) => {
    if (editor) {
      setCurrentRichEditorListType(editor, type);
    }
  });

  const handleToggleCurrentListChecklist = useLastCallback(() => {
    if (editor) {
      toggleCurrentRichEditorListChecklist(editor);
    }
  });

  const handleSetCurrentOrderedListType = useLastCallback((type: RichOrderedListType) => {
    if (editor) {
      setCurrentRichEditorOrderedListType(editor, type);
    }
  });

  const handleToggleCurrentOrderedListReversed = useLastCallback(() => {
    if (editor) {
      toggleCurrentRichEditorOrderedListReversed(editor);
    }
  });

  const handleInsertTable = useLastCallback(() => {
    if (!editor || !checkCanUseBlockOptions(editor)
      || !checkCanInsertBlockAtSelection(editor, INSERTED_BLOCK_NODE_TYPES.table)) {
      return;
    }

    const selectedText = getSelectedText(editor);
    const chain = editor.chain().focus().insertTable(DEFAULT_TABLE_OPTIONS);
    if (selectedText) {
      chain.command(({ tr }) => {
        tr.insertText(selectedText);
        return true;
      });
    }
    chain.run();
  });

  const handleOpenLinkModal = useLastCallback(() => {
    if (!editor || !availability.canInsertLink) {
      return;
    }

    openLinkModal();
  });

  const handleInsertLink = useLastCallback((text: string, url: string) => {
    if (!editor) {
      closeLinkModal();
      return;
    }

    editor.chain().focus().insertContent({
      type: 'text',
      text,
      marks: [{
        type: 'link',
        attrs: { href: formatLinkUrl(url) },
      }],
    }).run();
    closeLinkModal();
  });

  const handleToggleCodeBlock = useLastCallback(() => {
    editor?.chain().focus().toggleCodeBlock().run();
  });

  const handleInsertEquation = useLastCallback(() => {
    if (!editor) {
      return;
    }

    const equationNodeType = findInsertableEquationNodeType(editor, editor.can());
    if (!equationNodeType) {
      return;
    }

    const selectedText = getSelectedText(editor);
    const chain = editor.chain().focus().insertContent(buildEquationContent(equationNodeType, selectedText));
    if (equationNodeType === MATH_INLINE_NODE_NAME) {
      chain.command(({ tr }) => {
        const insertedNode = tr.selection.$from.nodeBefore;
        if (insertedNode?.type.name !== MATH_INLINE_NODE_NAME) {
          return false;
        }

        const insertedNodePosition = tr.selection.from - insertedNode.nodeSize;
        tr.setSelection(NodeSelection.create(tr.doc, insertedNodePosition));
        return true;
      });
    }
    chain.run();
  });

  const canOpenHeadingMenu = RICH_HEADING_LEVELS.some((level) => availability.canToggleHeadingByLevel[level]);
  const canOpenBlockMenu = canOpenHeadingMenu
    || availability.canToggleFooter
    || availability.canSetBlockquote
    || availability.canTogglePullquote
    || availability.canSetDetails
    || availability.canSetHorizontalRule;
  const currentList = availability.currentList;
  const canOpenListMenu = availability.canInsertBulletList
    || availability.canInsertOrderedList
    || Boolean(currentList);

  return (
    <div className="rich-editor-toolbar-viewport" aria-hidden={!isEnabled} inert={!isEnabled}>
      <div className="rich-editor-toolbar">
        <DropdownMenu
          className="rich-editor-toolbar-menu"
          positionX="left"
          positionY="bottom"
          withPortal
          trigger={({ onTrigger, isOpen }) => (
            <Button
              color="translucent"
              className={isOpen ? 'active' : undefined}
              iconName="add"
              ariaLabel={lang('RichEditorBlockMenu')}
              disabled={!canOpenBlockMenu}
              onClick={onTrigger}
            />
          )}
        >
          <NestedMenuItem
            icon="heading"
            hasIconPremiumBadge
            disabled={!canOpenHeadingMenu}
            submenu={(
              <>
                {RICH_HEADING_LEVELS.map((level) => (
                  <MenuItem
                    icon={`heading-${level}`}
                    disabled={!availability.canToggleHeadingByLevel[level]}
                    onClick={() => handleToggleHeading(level)}
                  >
                    {lang('RichEditorHeadingLevel', { level })}
                  </MenuItem>
                ))}
              </>
            )}
          >
            {lang('RichEditorHeading')}
          </NestedMenuItem>
          <MenuItem
            icon="footer"
            hasIconPremiumBadge
            disabled={!availability.canToggleFooter}
            onClick={handleToggleFooter}
          >
            {lang('RichEditorFooter')}
          </MenuItem>
          <MenuItem
            icon="blockquote"
            disabled={!availability.canSetBlockquote}
            onClick={handleSetBlockquote}
          >
            {lang('RichEditorBlockquote')}
          </MenuItem>
          <MenuItem
            icon="pullquote"
            hasIconPremiumBadge
            disabled={!availability.canTogglePullquote}
            onClick={handleTogglePullquote}
          >
            {lang('RichEditorPullquote')}
          </MenuItem>
          <MenuItem
            icon="details-block"
            hasIconPremiumBadge
            disabled={!availability.canSetDetails}
            onClick={handleSetDetails}
          >
            {lang('RichEditorDetails')}
          </MenuItem>
          <MenuItem
            icon="remove"
            hasIconPremiumBadge
            disabled={!availability.canSetHorizontalRule}
            onClick={handleSetHorizontalRule}
          >
            {lang('RichEditorDivider')}
          </MenuItem>
        </DropdownMenu>
        <DropdownMenu
          className="rich-editor-toolbar-menu"
          positionX="left"
          positionY="bottom"
          withPortal
          trigger={({ onTrigger, isOpen }) => (
            <Button
              color="translucent"
              className={isOpen ? 'active' : undefined}
              iconName="bullet-list"
              ariaLabel={lang('RichEditorListMenu')}
              iconHasPremiumBadge
              disabled={!canOpenListMenu}
              onClick={onTrigger}
            />
          )}
        >
          {LIST_INSERT_OPTIONS.map((option) => (
            <MenuItem
              key={option.label}
              icon={option.icon}
              hasIconPremiumBadge
              disabled={!availability[option.availability]}
              onClick={() => handleInsertList(option.type, option.isChecklist)}
            >
              {lang(option.label)}
            </MenuItem>
          ))}
          <MenuSeparator />
          <NestedMenuItem
            icon="settings"
            disabled={!currentList}
            submenu={(
              <>
                {LIST_TYPE_OPTIONS.map((option) => (
                  <MenuItem
                    key={option.type}
                    icon={currentList?.type === option.type ? 'check' : option.icon}
                    onClick={() => handleSetCurrentListType(option.type)}
                  >
                    {lang(option.label)}
                  </MenuItem>
                ))}
                <MenuSeparator />
                <MenuItem
                  icon={currentList?.isChecklist ? 'check' : 'task-list'}
                  onClick={handleToggleCurrentListChecklist}
                >
                  {lang('RichEditorListCheckmarks')}
                </MenuItem>
                <NestedMenuItem
                  icon="sort-by-number"
                  disabled={currentList?.type !== 'orderedList'}
                  submenu={(
                    <>
                      {RICH_ORDERED_LIST_TYPES.map((type) => (
                        <MenuItem
                          key={type}
                          icon={(currentList?.orderType ?? '1') === type ? 'check' : 'numbered-list'}
                          onClick={() => handleSetCurrentOrderedListType(type)}
                        >
                          {lang(ORDERED_LIST_TYPE_LABELS[type])}
                        </MenuItem>
                      ))}
                    </>
                  )}
                >
                  {lang('RichEditorListNumberingType')}
                </NestedMenuItem>
                <MenuItem
                  icon={currentList?.isReversed ? 'check' : 'sort'}
                  disabled={currentList?.type !== 'orderedList'}
                  onClick={handleToggleCurrentOrderedListReversed}
                >
                  {lang('RichEditorListReverseOrder')}
                </MenuItem>
              </>
            )}
          >
            {lang('RichEditorListOptions')}
          </NestedMenuItem>
        </DropdownMenu>
        <Button
          color="translucent"
          iconName="table"
          ariaLabel={lang('RichEditorTable')}
          iconHasPremiumBadge
          disabled={!availability.canInsertTable}
          onClick={handleInsertTable}
        />
        <Button
          color="translucent"
          iconName="link"
          ariaLabel={lang('FormattingAddLinkAria')}
          disabled={!availability.canInsertLink}
          onClick={handleOpenLinkModal}
        />
        <Button
          color="translucent"
          iconName="code"
          ariaLabel={lang('RichEditorCodeBlock')}
          disabled={!availability.canToggleCodeBlock}
          onClick={handleToggleCodeBlock}
        />
        <Button
          color="translucent"
          iconName="formula"
          ariaLabel={lang('RichEditorFormula')}
          iconHasPremiumBadge
          disabled={!availability.canInsertEquation}
          onClick={handleInsertEquation}
        />
      </div>
      <RichEditorLinkModal
        isOpen={isLinkModalOpen}
        onClose={closeLinkModal}
        onSubmit={handleInsertLink}
      />
    </div>
  );
};

export default memo(RichEditorToolbar);

function buildToolbarAvailability(editor: Editor): RichEditorToolbarAvailability {
  const commandChecks = editor.can();
  const canUseBlockOptions = checkCanUseBlockOptions(editor);
  const canToggleHeadingByLevel: Record<RichHeadingLevel, boolean> = {
    1: false,
    2: false,
    3: false,
    4: false,
    5: false,
    6: false,
  };
  RICH_HEADING_LEVELS.forEach((level) => {
    canToggleHeadingByLevel[level] = canUseBlockOptions && commandChecks.toggleHeading({ level });
  });

  const canSetDetails = canUseBlockOptions
    && checkCanSetBlockAtSelection(editor, INSERTED_BLOCK_NODE_TYPES.details);
  const canInsertDivider = canUseBlockOptions
    && checkCanInsertBlockAtSelection(editor, INSERTED_BLOCK_NODE_TYPES.divider);
  const canInsertTable = canUseBlockOptions
    && checkCanInsertBlockAtSelection(editor, INSERTED_BLOCK_NODE_TYPES.table);
  const canInsertLink = editor.state.selection.empty && commandChecks.setLink({ href: '' });
  const canInsertBulletList = canUseBlockOptions && checkCanInsertRichEditorList(editor, 'bulletList');

  return {
    canToggleHeadingByLevel,
    canToggleFooter: canUseBlockOptions
      && commandChecks.toggleNode(FOOTER_NODE_NAME, PARAGRAPH_NODE_TYPE),
    canSetBlockquote: canUseBlockOptions && commandChecks.setBlockquote(),
    canTogglePullquote: canUseBlockOptions && commandChecks.togglePullquote(),
    canSetDetails: canSetDetails && commandChecks.setDetails(),
    canSetHorizontalRule: canInsertDivider && commandChecks.setHorizontalRule(),
    canInsertBulletList,
    canInsertOrderedList: canUseBlockOptions && checkCanInsertRichEditorList(editor, 'orderedList'),
    currentList: getCurrentRichEditorList(editor),
    canInsertTable: canInsertTable && commandChecks.insertTable(DEFAULT_TABLE_OPTIONS),
    canInsertLink,
    canToggleCodeBlock: commandChecks.toggleCodeBlock(),
    canInsertEquation: Boolean(findInsertableEquationNodeType(editor, commandChecks)),
  };
}

function checkCanUseBlockOptions(editor: Editor) {
  return !editor.isActive(CODE_BLOCK_NODE_TYPE);
}

function checkCanInsertBlockAtSelection(editor: Editor, nodeTypeName: string) {
  const nodeType = editor.schema.nodes[nodeTypeName];
  if (!nodeType) {
    return false;
  }

  const { $from } = editor.state.selection;
  let parentDepth = $from.depth;
  while (parentDepth > 0 && $from.node(parentDepth).isTextblock) {
    parentDepth -= 1;
  }

  const parent = $from.node(parentDepth);
  const index = $from.index(parentDepth);

  return parent.canReplaceWith(index, index, nodeType)
    || parent.canReplaceWith(index + 1, index + 1, nodeType);
}

function checkCanSetBlockAtSelection(editor: Editor, nodeTypeName: string) {
  const nodeType = editor.schema.nodes[nodeTypeName];
  if (!nodeType) {
    return false;
  }

  const { $from, $to } = editor.state.selection;
  const range = $from.blockRange($to);

  return Boolean(range?.parent.canReplaceWith(range.startIndex, range.endIndex, nodeType));
}

function getSelectedText(editor: Editor) {
  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to, '\n');
}

function findInsertableEquationNodeType(editor: Editor, commandChecks: ReturnType<Editor['can']>) {
  if (checkCanUseBlockOptions(editor)
    && checkCanInsertBlockAtSelection(editor, MATH_BLOCK_NODE_NAME)
    && commandChecks.insertContent(EMPTY_BLOCK_EQUATION_CONTENT)) {
    return MATH_BLOCK_NODE_NAME;
  }

  return commandChecks.insertContent(EMPTY_INLINE_EQUATION_CONTENT) ? MATH_INLINE_NODE_NAME : undefined;
}

function buildEquationContent(type: MathNodeType, source: string) {
  return {
    type,
    attrs: { source },
  };
}
