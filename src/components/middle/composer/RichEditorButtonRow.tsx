import type { TeactNode } from '../../../lib/teact/teact';

import type { TeactNodeViewComponentProps } from '../../../util/tiptap/TeactNodeViewRenderer';

import { MAX_BUTTONS_PER_ROW } from '../../../global/helpers/buttons';
import buildClassName from '../../../util/buildClassName';
import { EMPTY_RICH_BUTTON, getButtonRowAlign } from '../../../util/tiptap/richButton';
import styles from '../../../util/tiptap/styling.module.scss';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import DropdownMenu from '../../ui/DropdownMenu';
import MenuItem from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';
import RichEditorButton from './RichEditorButton';

const ALIGN_OPTIONS = [
  { value: '', label: 'RichButtonStretch', icon: 'expand' },
  { value: 'left', label: 'RichButtonLeft', icon: 'table-align-left' },
  { value: 'center', label: 'RichButtonCenter', icon: 'table-align-center' },
  { value: 'right', label: 'RichButtonRight', icon: 'table-align-right' },
] as const;

const RichEditorButtonRow = ({
  editor, node, getPos, selected, updateAttributes, deleteNode,
}: TeactNodeViewComponentProps) => {
  const lang = useLang();
  const handleAdd = useLastCallback(() => {
    const position = getPos();
    if (position === undefined || node.childCount >= MAX_BUTTONS_PER_ROW) return;
    editor.view.dispatch(editor.state.tr.insert(
      position + node.nodeSize - 1, editor.schema.nodeFromJSON(EMPTY_RICH_BUTTON),
    ));
  });
  const handleAlign = useLastCallback((align: string) => updateAttributes({ align: getButtonRowAlign(align) }));
  const buttons: TeactNode[] = [];
  node.forEach((button, offset) => {
    buttons.push(
      <span key={buttons.length} className={styles.richButtonNode}>
        <RichEditorButton
          editor={editor}
          node={button}
          isInRow
          getPos={() => {
            const position = getPos();
            return position === undefined ? undefined : position + 1 + offset;
          }}
        />
      </span>,
    );
  });

  return (
    <div
      className={buildClassName(styles.buttonRowEditor, selected && styles.buttonRowSelected)}
      data-align={node.attrs.align}
      contentEditable={false}
    >
      <div className={buildClassName(styles.buttonRowBody, styles.buttonRowButtons)}>{buttons}</div>
      <div contentEditable={false}>
        <DropdownMenu
          positionX="right"
          withPortal
          trigger={({ onTrigger }) => (
            <Button
              className={styles.buttonRowMenu}
              round
              color="translucent-primary"
              iconName="more"
              ariaLabel={lang('RichButtonAlign')}
              onClick={onTrigger}
            />
          )}
        >
          <MenuItem icon="add" disabled={node.childCount >= MAX_BUTTONS_PER_ROW} onClick={handleAdd}>
            {lang('RichButtonAdd')}
          </MenuItem>
          <MenuSeparator />
          <div className={styles.buttonAlignmentGroup} role="group" aria-label={lang('RichButtonAlign')}>
            {ALIGN_OPTIONS.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                className={buildClassName(styles.buttonAlignmentOption,
                  (node.attrs.align || '') === value && styles.buttonAlignmentActive)}
                aria-label={lang(label)}
                aria-checked={(node.attrs.align || '') === value}
                title={lang(label)}
                onClick={() => handleAlign(value)}
              >
                <Icon name={icon} />
              </button>
            ))}
          </div>
          <MenuSeparator />
          <MenuItem icon="delete" destructive onClick={deleteNode}>{lang('Delete')}</MenuItem>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default RichEditorButtonRow;
