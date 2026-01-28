import { memo, useMemo, useRef } from '../../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../../global';

import type { ProviderRelationship } from '../../../../services/types';
import { ProviderEntityType, type ProviderPage } from '../../../../services/types';

import { selectCurrentMessageList } from '../../../../../global/selectors';
import {
  selectTelebizChatRelationships,
  selectTelebizSelectedRelationship,
} from '../../../../global/selectors';
import buildClassName from '../../../../../util/buildClassName';
import {
  getNotionPageProperty,
  getNotionPageStatus,
  getNotionPageTitle,
  getNotionSelectValue,
} from '../../../../util/notion';

import useContextMenuHandlers from '../../../../../hooks/useContextMenuHandlers';

import PeerChip from '../../../../../components/common/PeerChip';
import RelationshipItemContextMenu from '../RelationshipEntityContextMenu';

import commonItemCardStyles from '../RelationshipEntityCard.module.scss';
import styles from './Pages.module.scss';

interface OwnProps {
  page: ProviderPage;
  onPageSelected?: (page: ProviderPage) => void;
}

type StateProps = {
  relationshipsList: ProviderRelationship[];
  selectedRelationship?: ProviderRelationship;
};

const PageCard = ({
  page,
  onPageSelected,
  relationshipsList,
  selectedRelationship,
}: OwnProps & StateProps) => {
  const ref = useRef<HTMLDivElement>();
  const {
    handleContextMenu,
    isContextMenuOpen,
    contextMenuAnchor,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(ref);

  const { openChat } = getActions();

  const relationships = useMemo(() => {
    return relationshipsList.filter(
      (x: ProviderRelationship) =>
        String(x.entity_id) === String(page.id)
        && x.entity_type === ProviderEntityType.Page
        && x.integration_id === selectedRelationship?.integration_id
        && x.telegram_id !== selectedRelationship?.telegram_id,
    );
  }, [relationshipsList, page.id, selectedRelationship?.integration_id, selectedRelationship?.telegram_id]);

  const title = useMemo(() => {
    return getNotionPageTitle(page) || 'Untitled';
  }, [page]);

  const status = useMemo(() => {
    return getNotionPageStatus(page) || undefined;
  }, [page]);

  const priority = useMemo(() => {
    const priorityProp = getNotionPageProperty(page, 'Priority');
    return getNotionSelectValue(priorityProp) || undefined;
  }, [page]);

  const handleClick = () => {
    if (onPageSelected) {
      onPageSelected(page);
    } else if (page.url) {
      window.open(page.url, '_blank');
    }
  };

  return (
    <div
      className={buildClassName(
        commonItemCardStyles.item,
        styles.item,
        onPageSelected && commonItemCardStyles.linked,
      )}
      onContextMenu={handleContextMenu}
      ref={ref}
      onClick={handleClick}
    >
      <div className={commonItemCardStyles.itemHeader}>
        <div className={commonItemCardStyles.itemText}>
          {title}
        </div>
        {status && (
          <div className={styles.stage}>
            <p className={styles.itemStatusChipLabel}>{status}</p>
          </div>
        )}
      </div>

      <div className={commonItemCardStyles.itemBody}>
        {priority && (
          <p className={commonItemCardStyles.itemHighlight}>
            Priority:
            {' '}
            {priority}
          </p>
        )}
      </div>

      <div className={commonItemCardStyles.itemFooter}>
        <span className={commonItemCardStyles.itemType}>
          Notion Page
        </span>
      </div>

      {
        relationships.length > 0 && (
          relationships.map((x: ProviderRelationship) => (
            <PeerChip
              key={x.id}
              peerId={x.telegram_id}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                openChat({ id: x.telegram_id, shouldReplaceHistory: true });
              }}
              className={styles.itemChatChip}
            />
          ))
        )
      }
      {contextMenuAnchor && (
        <RelationshipItemContextMenu
          type={ProviderEntityType.Page}
          triggerRef={ref}
          entity={page}
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

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};

    return {
      relationshipsList: chatId ? selectTelebizChatRelationships(global, chatId) : [],
      selectedRelationship: chatId ? selectTelebizSelectedRelationship(global, chatId) : undefined,
    };
  },
)(PageCard));
