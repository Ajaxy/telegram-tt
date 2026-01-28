import { memo, useMemo } from '@teact';
import { withGlobal } from '../../../../../global';

import type {
  PropertiesByEntityType,
  ProviderCompany,
  ProviderContact,
  ProviderDeal,
  ProviderEntity,
  ProviderPage,
} from '../../../../services';

import { selectTelebizProperties, selectTelebizSelectedIntegrationId } from '../../../../global/selectors';
import { getEntityTitle } from '../../../../util/general';
import {
  getNotionPageProperty,
  getNotionPageStatus,
  getNotionSelectValue,
} from '../../../../util/notion';
import { ProviderEntityType } from '../../../../services';

import { useProviderProperty } from '../../../../hooks/useProviderProperty';

import styles from '../TelebizAddRelationship.module.scss';

interface OwnProps {
  entity: ProviderEntity;
  entityType: ProviderEntityType;
}

type StateProps = {
  propertiesByEntityType: PropertiesByEntityType[];
};

const EntityDetails = ({ entity, entityType, propertiesByEntityType }: OwnProps & StateProps) => {
  const properties = useMemo(
    () => propertiesByEntityType.find((p) => p.id as ProviderEntityType === entityType)?.properties || [],
    [propertiesByEntityType, entityType],
  );
  const { getPropertyLabel, getPropertyValueFromOptions } = useProviderProperty(properties);

  const entityDetails = useMemo(() => {
    switch (entityType) {
      case ProviderEntityType.Deal: {
        const deal = entity as ProviderDeal;
        const pipelineValue = getPropertyValueFromOptions(deal.pipeline, 'pipeline', undefined);
        const stageValue = getPropertyValueFromOptions(deal.stage, 'stage', deal.pipeline);

        const formattedAmount = deal.amount
          ? new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: deal.currency || 'USD',
          }).format(Number(deal.amount))
          : 'N/A';

        const formattedCloseDate = deal.closeDate
          ? new Date(deal.closeDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
          : 'Not set';

        return [
          { label: getPropertyLabel('amount'), value: formattedAmount },
          { label: getPropertyLabel('pipeline'), value: pipelineValue || 'N/A' },
          { label: getPropertyLabel('stage'), value: stageValue || 'N/A' },
          { label: getPropertyLabel('closeDate'), value: formattedCloseDate },
        ];
      }
      case ProviderEntityType.Contact: {
        const contact = entity as ProviderContact;

        const formattedLastContact = contact.lastContact
          ? new Date(contact.lastContact).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
          : 'Never';

        return [
          { label: getPropertyLabel('email'), value: contact.email || 'Not provided' },
        ].concat(
          contact.phone ? [{ label: getPropertyLabel('phone'), value: contact.phone }] : [],
          contact.company ? [{ label: getPropertyLabel('company'), value: contact.company }] : [],
          contact.jobTitle ? [{ label: getPropertyLabel('jobtitle'), value: contact.jobTitle }] : [],
          contact.lastContact ? [{ label: 'LastContact', value: formattedLastContact }] : [],
        );
      }
      case ProviderEntityType.Company: {
        const company = entity as ProviderCompany;
        return [
          { label: getPropertyLabel('website'), value: company.website || 'Not provided' },
        ];
      }
      case ProviderEntityType.Page: {
        const page = entity as ProviderPage;
        const details: { label: string; value: string | React.ReactNode }[] = [];
        if (page.properties) {
          const statusName = getNotionPageStatus(page);
          if (statusName) {
            details.push({ label: 'Status', value: statusName });
          }

          const priorityProp = getNotionPageProperty(page, 'Priority');
          const priorityName = getNotionSelectValue(priorityProp);
          if (priorityName) {
            details.push({ label: 'Priority', value: priorityName });
          }
        }
        if (page.url) {
          details.push({
            label: 'Link',
            value: (
              <a
                href={page.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--color-primary)' } as any}
              >
                Open
              </a>
            ),
          });
        }
        return details;
      }
      default: {
        return [];
      }
    }
  }, [entity, entityType, getPropertyLabel, getPropertyValueFromOptions]);

  return (
    <div className={styles.selectedEntityDetails}>
      <div className={styles.selectedEntityHeader}>
        <div className={styles.selectedEntityName}>
          {getEntityTitle(entity, entityType)}
        </div>
      </div>

      {entityDetails && (
        <div className={styles.selectedEntitySection}>
          {entityDetails.map((detail) => (
            <div key={detail.label} className={styles.selectedEntityRow}>
              <div className={styles.selectedEntityKey}>{detail.label}</div>
              <div className={styles.selectedEntityValue}>{detail.value}</div>
            </div>
          ))}
        </div>
      )}

      {entity.metadata?.owner && (
        <div className={styles.selectedEntitySection}>
          <div className={styles.selectedEntityRow}>
            <div className={styles.selectedEntityKey}>Owner</div>
            <div className={styles.selectedEntityValue}>{entity.metadata.owner.name}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const integrationId = selectTelebizSelectedIntegrationId(global);
    return {
      propertiesByEntityType: integrationId ? selectTelebizProperties(global, integrationId) : [],
    };
  },
)(EntityDetails));
