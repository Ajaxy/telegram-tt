import { memo, useMemo, useRef } from '../../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../../global';

import type { Property, ProviderRelationship } from '../../../../services/types';
import { type ProviderCompany, ProviderEntityType } from '../../../../services/types';

import { selectCurrentMessageList } from '../../../../../global/selectors';
import {
  selectTelebizPropertiesByEntityType,
  selectTelebizRelationshipsByEntity,
  selectTelebizSelectedRelationship,
} from '../../../../global/selectors';
import buildClassName from '../../../../../util/buildClassName';

import useContextMenuHandlers from '../../../../../hooks/useContextMenuHandlers';
import { useProviderProperty } from '../../../../hooks/useProviderProperty';

import Icon from '../../../../../components/common/icons/Icon';
import PeerChip from '../../../../../components/common/PeerChip';
import RelationshipItemContextMenu from '../RelationshipEntityContextMenu';

import commonItemCardStyles from '../RelationshipEntityCard.module.scss';
import styles from './Companies.module.scss';

interface OwnProps {
  company: ProviderCompany;
  onCompanySelected?: (company: ProviderCompany) => void;
}

type StateProps = {
  relationshipsList: ProviderRelationship[];
  selectedRelationship?: ProviderRelationship;
  properties: Property[];
};

const CompanyCard = ({
  company,
  onCompanySelected,
  relationshipsList,
  selectedRelationship,
  properties,
}: OwnProps & StateProps) => {
  const { openChat } = getActions();
  const { getPropertyValueFromOptions } =
    useProviderProperty(properties);

  const ref = useRef<HTMLDivElement>();
  const {
    handleContextMenu,
    isContextMenuOpen,
    contextMenuAnchor,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(ref);

  const industryLabel = getPropertyValueFromOptions(
    company.industry,
    'industry',
  );

  const relationships = useMemo(() => {
    return relationshipsList.filter(
      (x: ProviderRelationship) =>
        String(x.entity_id) === String(company.id)
        && x.entity_type === ProviderEntityType.Company
        && x.integration_id === selectedRelationship?.integration_id,
    );
  }, [relationshipsList, company.id, selectedRelationship?.integration_id]);

  return (
    <div
      className={buildClassName(
        commonItemCardStyles.item,
        styles.item,
      )}
      onContextMenu={handleContextMenu}
      ref={ref}
    >
      <div className={commonItemCardStyles.itemHeader}>
        <div className={commonItemCardStyles.itemHeaderTitle}>
          <Icon name="group" className={styles.companyIcon} />
          <div className={commonItemCardStyles.itemHighlight}>
            {company.name}
          </div>
        </div>
      </div>
      <div className={commonItemCardStyles.itemBody}>
        <p className={commonItemCardStyles.itemText}>
          {[industryLabel, company.size].filter(Boolean).join(' • ')}
        </p>
      </div>
      <div className={commonItemCardStyles.itemFooter}>
        <span className={commonItemCardStyles.itemType}>
          {company.website ? `${String(company.website)}` : ''}
          {company.website && company.city ? ' • ' : ''}
          {company.city ? `${String(company.city)}` : ''}
          {(company.website || company.city) && company.country ? ' • ' : ''}
          {company.country ? `${String(company.country)}` : ''}
        </span>
      </div>
      {relationships.length > 0 && (
        relationships.map((x: ProviderRelationship) => (
          <PeerChip
            key={x.id}
            peerId={x.telegram_id}
            onClick={() => {
              openChat({ id: x.telegram_id, shouldReplaceHistory: true });
            }}
            className={styles.itemCompanyChip}
          />
        ))
      )}
      {contextMenuAnchor && (
        <RelationshipItemContextMenu
          type={ProviderEntityType.Company}
          triggerRef={ref}
          entity={company}
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
  (global, { company }: OwnProps): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};
    const selectedRelationship = chatId ? selectTelebizSelectedRelationship(global, chatId) : undefined;
    const properties = selectedRelationship ?
      selectTelebizPropertiesByEntityType(global, selectedRelationship.integration_id, ProviderEntityType.Company) : [];

    return {
      relationshipsList: selectTelebizRelationshipsByEntity(
        global,
        company.id,
        ProviderEntityType.Company,
        selectedRelationship?.integration_id || 0,
      ) || [],
      selectedRelationship,
      properties,
    };
  },
)(CompanyCard));
