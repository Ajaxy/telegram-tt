import { NodeViewContent, type TeactNodeViewComponentProps } from '../../../../util/tiptap';
import styles from '../../../../util/tiptap/styling.module.scss';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Checkbox from '../../../gili/primitives/Checkbox';

const EditableListItem = ({
  editor,
  node,
  updateAttributes,
}: TeactNodeViewComponentProps) => {
  const lang = useLang();
  const hasCheckbox = Boolean(node.attrs.checkbox);
  const isChecked = Boolean(node.attrs.checked);

  const handleMouseDown = useLastCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
  });

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation();
  });

  const handleChange = useLastCallback((checked: boolean) => {
    if (!editor.isEditable) {
      return;
    }

    updateAttributes({ checked });
  });

  return (
    <div className={hasCheckbox ? styles.listCheckboxItem : undefined}>
      <span
        className={styles.listCheckboxWrapper}
        contentEditable={false}
        hidden={!hasCheckbox}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        {hasCheckbox && (
          <Checkbox
            checked={isChecked}
            aria-label={lang('TitleTask')}
            onChange={handleChange}
          />
        )}
      </span>
      <NodeViewContent className={hasCheckbox ? styles.listItemContent : undefined} />
    </div>
  );
};

export default EditableListItem;
