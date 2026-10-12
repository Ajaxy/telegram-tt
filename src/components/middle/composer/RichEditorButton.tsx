import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { useMemo } from '../../../lib/teact/teact';

import type { TeactNodeViewComponentProps } from '../../../util/tiptap/TeactNodeViewRenderer';

import buildClassName from '../../../util/buildClassName';
import { buildButtonAction, BUTTON_ROW_NODE_NAME } from '../../../util/tiptap/richButton';
import styles from '../../../util/tiptap/styling.module.scss';
import { buildRichTextFromTiptapContent } from '../../ui/textInput/richText';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useUniqueId from '../../../hooks/useUniqueId';

import Icon from '../../common/icons/Icon';
import { RICH_BUTTON_ICONS } from '../../iv/RichButton';
import RichText from '../../iv/RichText';
import RichEditorButtonModal from './RichEditorButtonModal';

type OwnProps = Pick<TeactNodeViewComponentProps, 'editor' | 'node' | 'getPos'> & {
  selected?: boolean;
  isInRow?: boolean;
};

const RichEditorButton = ({ editor, node, getPos, selected, isInRow }: OwnProps) => {
  const [isModalOpen, openModal, closeModal] = useFlag();
  const lang = useLang();
  const containerId = useUniqueId();
  const text = useMemo(() => buildRichTextFromTiptapContent(node.content.toJSON()), [node]);
  const icon = RICH_BUTTON_ICONS[buildButtonAction(node.attrs)?.type || 'url'];

  const handleOpen = useLastCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const position = getPos();
    if (position === undefined) return;
    if (!isInRow) editor.commands.setNodeSelection(position);
    openModal();
  });
  const handleSave = useLastCallback((replacement: ProseMirrorNode) => {
    const position = getPos();
    if (position === undefined) return;
    editor.view.dispatch(editor.state.tr.replaceWith(position, position + node.nodeSize, replacement));
    closeModal();
    editor.commands.focus();
  });
  const handleDelete = useLastCallback(() => {
    const position = getPos();
    if (position === undefined) return;
    const resolved = editor.state.doc.resolve(position);
    const shouldDeleteRow = resolved.parent.type.name === BUTTON_ROW_NODE_NAME && resolved.parent.childCount === 1;
    closeModal();
    editor.commands.deleteRange({
      from: shouldDeleteRow ? resolved.before() : position,
      to: shouldDeleteRow ? resolved.after() : position + node.nodeSize,
    });
    editor.commands.focus();
  });

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        className={buildClassName(styles.richButton, icon && styles.richButtonWithIcon,
          selected && styles.richButtonSelected)}
        data-color={node.attrs.color}
        data-disabled={node.attrs.buttonType === 'disabled' || undefined}
        contentEditable={false}
        aria-label={node.content.size ? undefined : lang('RichButtonEdit')}
        onMouseDown={(e: React.MouseEvent<HTMLButtonElement>) => e.preventDefault()}
        onClick={handleOpen}
      >
        <span className={styles.richButtonLabel}>
          <RichText
            text={text}
            isButtonLabel
            containerId={containerId}
            unsupportedText={lang('PageContentUnsupported')}
          />
        </span>
        {icon && (
          <Icon
            name={icon}
            className={buildClassName(styles.richButtonIcon,
              icon === 'arrow-right' && styles.richButtonExternalIcon)}
          />
        )}
      </button>
      {isModalOpen && (
        <RichEditorButtonModal
          node={node}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={closeModal}
        />
      )}
    </>
  );
};

export default RichEditorButton;
