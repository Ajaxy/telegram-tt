import { memo, useEffect } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type {
  Integration,
  Property,
  ProviderCompany,
  ProviderContact,
  ProviderDeal,
  ProviderPage,
} from '../../../services';
import { TelebizPanelScreens } from '../types';

import {
  selectTelebizEntity,
  selectTelebizEntityLoadError,
  selectTelebizIntegrationsList,
  selectTelebizPropertiesByEntityType,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { getDealColorByProbability } from '../../../util/general';
import { getNotionPageStatus, getNotionPageTitle } from '../../../util/notion';
import { ProviderEntityType as EntityType, type ProviderRelationship } from '../../../services';

import { useProviderProperty } from '../../../hooks/useProviderProperty';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Icon from '../../../../components/common/icons/Icon';
import ListItem from '../../../../components/ui/ListItem';
import TelebizPlaceholder from '../../common/TelebizPlaceholder';
import NotionIcon from '../../icons/Notion';

import styles from './TelebizRelationshipsList.module.scss';

const ContactItem = ({ contact, integration }: { contact: ProviderContact; integration?: Integration }) => {
  return (
    <div className={buildClassName(styles.itemContent, styles.contact)}>
      <div className={styles.title}>
        <Icon name="user" className={styles.icon} />
        <span className={styles.titleText}>{contact.name}</span>
        {integration && (
          <div className={styles.integrationIcon}>
            <img
              src={integration?.provider.icon_url}
              alt={integration?.provider.display_name}
            />
          </div>
        )}
      </div>
      <div className={styles.details}>
        <p>{[contact.company, contact.jobTitle].filter(Boolean).join(' • ')}</p>
      </div>
    </div>
  );
};

const CompanyItem = ({ company, properties, integration }:
{ company: ProviderCompany; properties: Property[]; integration?: Integration }) => {
  const { getPropertyValueFromOptions } = useProviderProperty(properties);
  const industry = getPropertyValueFromOptions(
    company?.industry, 'industry',
  );
  return (
    <div className={buildClassName(styles.itemContent, styles.contact)}>
      <div className={styles.title}>
        <Icon name="group" className={styles.icon} />
        <span className={styles.titleText}>{company.name}</span>
        {integration && (
          <div className={styles.integrationIcon}>
            <img
              src={integration?.provider.icon_url}
              alt={integration?.provider.display_name}
            />
          </div>
        )}
      </div>
      <div className={styles.details}>
        <p>{[industry, company.country].filter(Boolean).join(' • ')}</p>
      </div>
    </div>
  );
};

const DealItem = ({ deal, properties, integration }:
{ deal: ProviderDeal; properties: Property[]; integration?: Integration }) => {
  const { getPropertyValueFromOptions } = useProviderProperty(properties);
  const currency = deal?.currency || 'USD';
  const formattedValue = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(deal?.amount));
  const stageClassName = getDealColorByProbability(deal.probability || 0);

  const stageValue = getPropertyValueFromOptions('stage', deal?.pipeline, deal?.stage);

  return (
    <div className={buildClassName(styles.itemContent, styles[stageClassName])}>
      <div className={styles.title}>
        <Icon name="cash-circle" className={styles.icon} />
        <span className={styles.titleText}>{deal.title}</span>
        {integration && (
          <div className={styles.integrationIcon}>
            <img
              src={integration?.provider.icon_url}
              alt={integration?.provider.display_name}
            />
          </div>
        )}
      </div>
      <div className={styles.details}>
        <p>
          {[formattedValue, stageValue].filter(Boolean).join(' • ')}
        </p>
      </div>
    </div>
  );
};

const PageItem = ({ page, integration }: { page: ProviderPage; integration?: Integration }) => {
  return (
    <div className={buildClassName(styles.itemContent, styles.contact)}>
      <div className={styles.title}>
        <NotionIcon className={styles.icon} />
        <span className={styles.titleText}>{getNotionPageTitle(page)}</span>
        {integration && (
          <div className={styles.integrationIcon}>
            <img
              src={integration?.provider.icon_url}
              alt={integration?.provider.display_name}
            />
          </div>
        )}
      </div>
      <div className={styles.details}>
        <p>{getNotionPageStatus(page)}</p>
      </div>
    </div>
  );
};

interface OwnProps {
  relationship: ProviderRelationship;
  chatId: string;
}

type StateProps = {
  entity?: ProviderContact | ProviderDeal | ProviderPage | undefined;
  integrations: Integration[];
  hasLoadError: boolean;
  properties: Property[];
};

const TelebizRelationshipsListItem = ({
  relationship,
  chatId,
  entity,
  integrations,
  hasLoadError,
  properties,
}: OwnProps & StateProps) => {
  const {
    openTelebizPanelScreen,
    setTelebizIsAddingRelationship,
    setTelebizChatSelectedRelationship,
    loadTelebizEntity,
  } = getActions();

  const lang = useTelebizLang();

  useEffect(() => {
    if (!entity && !hasLoadError) {
      loadTelebizEntity({
        integrationId: relationship.integration_id,
        entityType: relationship.entity_type,
        entityId: relationship.entity_id,
      });
    }
  }, [
    entity,
    hasLoadError,
    loadTelebizEntity,
    relationship.integration_id,
    relationship.entity_type,
    relationship.entity_id,
  ]);

  const handleClick = () => {
    setTelebizIsAddingRelationship({ isAdding: false });
    setTelebizChatSelectedRelationship({ chatId, relationshipId: relationship.id });
    openTelebizPanelScreen({ screen: TelebizPanelScreens.Main });
  };

  const renderRelationshipItem = () => {
    const integration = integrations.find((it) => it.id === relationship.integration_id);

    if (!entity) return undefined;
    switch (relationship.entity_type) {
      case EntityType.Contact:
        return <ContactItem contact={entity as ProviderContact} integration={integration} />;
      case EntityType.Deal:
        return (
          <DealItem
            deal={entity as ProviderDeal}
            integration={integration}
            properties={properties}
          />
        );
      case EntityType.Company:
        return (
          <CompanyItem
            company={entity as ProviderCompany}
            integration={integration}
            properties={properties}
          />
        );
      case EntityType.Page:
        return <PageItem page={entity as ProviderPage} integration={integration} />;
      default:
        return undefined;
    }
  };

  const renderErrorItem = () => {
    const integration = integrations.find((it) => it.id === relationship.integration_id);
    return (
      <div className={buildClassName(styles.itemContent, styles.error)}>
        <div className={styles.title}>
          <Icon name="warning" className={styles.icon} />
          <span className={styles.titleText}>{lang('EntityLoadError.ListItemTitle')}</span>
          {integration && (
            <div className={styles.integrationIcon}>
              <img
                src={integration?.provider.icon_url}
                alt={integration?.provider.display_name}
              />
            </div>
          )}
        </div>
        <div className={styles.details}>
          <p>{lang('EntityLoadError.ListItemDescription')}</p>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (hasLoadError) return renderErrorItem();
    if (!entity) return <TelebizPlaceholder className={styles.itemPlaceholder} />;
    return renderRelationshipItem();
  };

  return (
    <ListItem
      key={relationship.id}
      buttonClassName={styles.listButton}
      className={styles.itemWrapper}
      onClick={handleClick}
    >
      {renderContent()}
    </ListItem>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { relationship }): StateProps => {
    const entityLoadError = selectTelebizEntityLoadError(global);
    const hasLoadError = Boolean(
      entityLoadError
      && entityLoadError.integrationId === relationship.integration_id
      && entityLoadError.entityType === relationship.entity_type
      && entityLoadError.entityId === relationship.entity_id,
    );

    const properties = selectTelebizPropertiesByEntityType(
      global,
      relationship.integration_id,
      relationship.entity_type,
    );

    return {
      entity: selectTelebizEntity(
        global,
        relationship.integration_id,
        relationship.entity_type,
        relationship.entity_id,
      ) as ProviderContact | ProviderDeal | ProviderPage | undefined,
      integrations: selectTelebizIntegrationsList(global),
      hasLoadError,
      properties,
    };
  },
)(TelebizRelationshipsListItem));
