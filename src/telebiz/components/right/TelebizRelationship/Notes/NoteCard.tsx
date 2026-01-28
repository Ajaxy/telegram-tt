import { memo, useRef } from '@teact';

import { ProviderEntityType, type ProviderNote } from '../../../../services/types';

import buildClassName from '../../../../../util/buildClassName';
import { formatDateTime } from '../../../../util/dates';
import { getOwnerDisplayString } from '../../../../util/general';

import useContextMenuHandlers from '../../../../../hooks/useContextMenuHandlers';

import RelationshipItemContextMenu from '../RelationshipEntityContextMenu';

import commonItemCardStyles from '../RelationshipEntityCard.module.scss';
import styles from './Notes.module.scss';
interface Props {
  note: ProviderNote;
}

const NoteCard = ({ note }: Props) => {
  const ref = useRef<HTMLDivElement>();
  const {
    handleContextMenu,
    isContextMenuOpen,
    contextMenuAnchor,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(
    ref,
  );
  return (
    <div
      className={buildClassName(commonItemCardStyles.item, styles.item)}
      onContextMenu={handleContextMenu}
      ref={ref}
    >
      <div className={commonItemCardStyles.itemHeader}>
        <div className={commonItemCardStyles.itemText}>
          {formatDateTime(note.createdAt)}
        </div>
      </div>
      <div className={commonItemCardStyles.itemBody}>
        <div className={commonItemCardStyles.itemHighlight} dangerouslySetInnerHTML={{ __html: note.body }} />
      </div>
      <div className={commonItemCardStyles.itemFooter}>
        {note.owner && (
          <span className={commonItemCardStyles.itemOwner}>
            {getOwnerDisplayString(note.owner)}
          </span>
        )}
      </div>
      {contextMenuAnchor && (
        <RelationshipItemContextMenu
          type={ProviderEntityType.Note}
          triggerRef={ref}
          entity={note}
          rootElementClassName=".TelebizRelationship-module__tabContainer"
          isContextMenuOpen={isContextMenuOpen}
          contextMenuAnchor={contextMenuAnchor}
          handleContextMenuClose={handleContextMenuClose}
          handleContextMenuHide={handleContextMenuHide}
        />
      )}
    </div>
  );
};

export default memo(NoteCard);
