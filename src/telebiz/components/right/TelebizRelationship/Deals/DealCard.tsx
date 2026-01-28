import { memo, useMemo, useRef } from '../../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../../global';

import type { Property, ProviderRelationship } from '../../../../services/types';
import { type ProviderDeal, ProviderEntityType } from '../../../../services/types';

import { selectCurrentMessageList } from '../../../../../global/selectors';
import {
  selectTelebizPropertiesByEntityType,
  selectTelebizRelationshipsByEntity,
  selectTelebizSelectedRelationship,
} from '../../../../global/selectors';
import buildClassName from '../../../../../util/buildClassName';
import { formatDate } from '../../../../util/dates';
import { getDealColorByProbability } from '../../../../util/general';

import useContextMenuHandlers from '../../../../../hooks/useContextMenuHandlers';
import { useProviderProperty } from '../../../../hooks/useProviderProperty';

import PeerChip from '../../../../../components/common/PeerChip';
import RelationshipItemContextMenu from '../RelationshipEntityContextMenu';

import commonItemCardStyles from '../RelationshipEntityCard.module.scss';
import styles from './Deals.module.scss';

interface OwnProps {
  deal: ProviderDeal;
}

type StateProps = {
  relationshipsList: ProviderRelationship[];
  selectedRelationship?: ProviderRelationship;
  properties: Property[];
};

const DealCard = ({
  deal,
  relationshipsList,
  selectedRelationship,
  properties,
}: OwnProps & StateProps) => {
  const ref = useRef<HTMLDivElement>();
  const {
    handleContextMenu,
    isContextMenuOpen,
    contextMenuAnchor,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(ref);

  const { getPropertyValueFromOptions } =
    useProviderProperty(properties);

  const { openChat } = getActions();

  const currency = deal?.currency || 'USD';

  const formattedValue = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(deal?.amount));

  const color = getDealColorByProbability(deal.probability || 0);

  const stageValue = getPropertyValueFromOptions(deal?.stage, 'stage', deal?.pipeline);
  const pipelineValue = getPropertyValueFromOptions(deal?.pipeline, 'pipeline', undefined);

  const relationships = useMemo(() => {
    return relationshipsList.filter(
      (x: ProviderRelationship) =>
        String(x.entity_id) === String(deal.id)
        && x.entity_type === ProviderEntityType.Deal
        && x.integration_id === selectedRelationship?.integration_id
        && x.telegram_id !== selectedRelationship?.telegram_id,
    );
  }, [relationshipsList, deal.id, selectedRelationship?.integration_id, selectedRelationship?.telegram_id]);

  return (
    <div
      className={
        buildClassName(
          commonItemCardStyles.item,
          styles.item,
          styles[color],
        )
      }
      onContextMenu={handleContextMenu}
      ref={ref}
    >
      <div className={commonItemCardStyles.itemHeader}>
        <div className={commonItemCardStyles.itemText}>
          {pipelineValue || ''}

        </div>
        <div className={buildClassName(styles.stage, styles[`stage-${color}`])}>
          <p className={styles.itemStatusChipLabel}>{stageValue || 'Open'}</p>
        </div>
      </div>
      {
        formattedValue && (
          <div className={commonItemCardStyles.itemBody}>
            <p className={commonItemCardStyles.itemHighlight}>{deal.title}</p>
          </div>
        )
      }
      <div className={commonItemCardStyles.itemFooter}>
        <span className={commonItemCardStyles.itemType}>
          {formattedValue}
          {' \u2022 '}
          {deal.status}
          {deal.closeDate ? ` \u2022 Close date: ${formatDate(deal.closeDate)}` : ''}
        </span>
      </div>
      {
        relationships.length > 0 && (
          relationships.map((x: ProviderRelationship) => (
            <PeerChip
              key={x.id}
              peerId={x.telegram_id}
              onClick={() => {
                openChat({ id: x.telegram_id, shouldReplaceHistory: true });
              }}
              className={styles.itemChatChip}
            />
          ))
        )
      }
      {contextMenuAnchor && (
        <RelationshipItemContextMenu
          type={ProviderEntityType.Deal}
          triggerRef={ref}
          entity={deal}
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
  (global, { deal }: OwnProps): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};
    const selectedRelationship = chatId ? selectTelebizSelectedRelationship(global, chatId) : undefined;

    const properties = selectedRelationship ?
      selectTelebizPropertiesByEntityType(global, selectedRelationship.integration_id, ProviderEntityType.Deal) : [];

    return {
      relationshipsList: selectTelebizRelationshipsByEntity(
        global, deal.id, ProviderEntityType.Deal, selectedRelationship?.integration?.id || 0,
      ) || [],
      selectedRelationship,
      properties,
    };
  },
)(DealCard));
