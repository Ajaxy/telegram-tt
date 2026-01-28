import { memo, useMemo } from '../../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../../global';

import type {
  Property,
  ProviderActivity,
  ProviderCompany,
  ProviderContact,
  ProviderDeal,
  ProviderNote,
  ProviderPage,
  ProviderRelationship,
  ProviderTask,
} from '../../../../services/types';
import {
  type Integration,
  type ProviderEntity,
  ProviderEntityType,
  type ProviderMeeting,
  ProviderMeetingStatus,
} from '../../../../services/types';

import { selectCurrentMessageList } from '../../../../../global/selectors';
import {
  selectTelebizEntityLoadingState,
  selectTelebizPropertiesByEntityType,
  selectTelebizSelectedRelationship,
} from '../../../../global/selectors';
import { formatPastTimeShort } from '../../../../../util/dates/dateFormat';
import { formatDate, formatDateTime } from '../../../../util/dates';
import { getOwnerDisplayString } from '../../../../util/general';
import { formatNotionProperty } from '../../../../util/notion';

import useOldLang from '../../../../../hooks/useOldLang';
import { useProviderProperty } from '../../../../hooks/useProviderProperty';

import Icon from '../../../../../components/common/icons/Icon';
import Spinner from '../../../../../components/ui/Spinner';
import {
  getOverviewFieldNames,
  hasOverviewFields,
} from '../../../common/ProviderEntityForm/fieldConfig';
import NotionBlocks from '../NotionBlocks';
import RelationshipEntityList from '../RelationshipEntityList';
import RelationshipTabContainer from '../RelationshipTabContainer';
import RelationshipTabMetrics, { type MetricItem } from '../RelationshipTabMetrics';

import relationshipStyles from '../TelebizRelationship.module.scss';
import styles from './Overview.module.scss';

interface InfoItem {
  label: string;
  value: string | React.ReactNode | number;
}

interface Metrics {
  title: string;
  items: MetricItem[][];
}

const InfoItemComponent = memo(({ label, value }: { label: string; value: string | React.ReactNode | number }) => {
  return (
    <div className={styles.metricsRow}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
    </div>
  );
});

interface OwnProps {
  entity?: ProviderEntity;
  entityType?: ProviderEntityType;
  integration?: Integration;
  closeDate?: string;
  probability?: number;
  onEntitySelected: (entity: ProviderContact | ProviderDeal | ProviderCompany, entityType: ProviderEntityType) => void;
}

type StateProps = {
  selectedRelationship?: ProviderRelationship;
  loadingState?: { entityId?: string; loadingType?: string };
  properties: Property[];
};

const RelationshipOverview = memo(({
  entity,
  integration,
  closeDate,
  probability,
  entityType,
  selectedRelationship,
  loadingState,
  properties,
  onEntitySelected,
}: OwnProps & StateProps) => {
  const oldLang = useOldLang();
  const { loadTelebizEntity } = getActions();

  const { getPropertyLabel, formatPropertyValue } =
    useProviderProperty(properties);

  const { infoItems, metricItems }: { infoItems?: InfoItem[]; metricItems?: Metrics } = useMemo(() => {
    if (!entity || !entityType) return {};

    if (entityType === ProviderEntityType.Page) {
      entity.createdAt = (entity as ProviderPage)?.created_time || '';
      entity.updatedAt = (entity as ProviderPage)?.last_edited_time || '';
    }

    const ageDays = ((new Date().getTime() - new Date(entity?.createdAt).getTime()) / (1000 * 60 * 60 * 24)).toFixed();
    const owner = entity?.metadata?.owner;

    const isLoading = loadingState && (loadingState.entityId === entity.id || !loadingState.entityId);

    const commonItems: InfoItem[] = [
      { label: 'Age', value: ageDays !== undefined ? `${ageDays}d` : '\u2014' },
      { label: 'Last Updated', value: entity?.updatedAt ? formatDateTime(entity?.updatedAt) : '\u2014' },
      {
        label: 'Provider',
        value: (
          <>
            {integration?.provider.icon_url && (
              <img
                src={integration?.provider.icon_url}
                alt={integration?.provider.display_name}
                className={styles.providerIcon}
              />
            )}
            {integration?.provider.display_name}
          </>
        ),
      },
      {
        label: 'Last Provider Sync',
        value: entity?.lastSyncAt ? (

          <div className={styles.lastSyncAt}>
            <div
              className={styles.lastSyncAtReload}
              onClick={() => {
                if (!selectedRelationship) return;
                loadTelebizEntity({
                  integrationId: selectedRelationship.integration_id,
                  entityType: selectedRelationship.entity_type,
                  entityId: selectedRelationship.entity_id,
                  forceRefresh: true,
                });
              }}
            >
              {
                isLoading ? <Spinner className={styles.lastSyncAtReloadIcon} color="white" /> :
                  <Icon name="schedule" className={styles.lastSyncAtReloadIcon} />
              }
            </div>
            <div className={styles.lastSyncAtLabel}>
              {formatPastTimeShort(oldLang, entity.lastSyncAt)}
            </div>
          </div>
        ) : '\u2014',
      },
    ];
    // Build dynamic property items for providers with field configuration
    const providerName = integration?.provider?.name;
    const dynamicItems: InfoItem[] = (() => {
      if (!providerName || !hasOverviewFields(providerName, entityType)) {
        return [];
      }

      const fieldNames = getOverviewFieldNames(providerName, entityType);
      const items: InfoItem[] = [];

      fieldNames.forEach((fieldName) => {
        const value = formatPropertyValue(entity, fieldName, providerName);
        if (value) {
          items.push({
            label: getPropertyLabel(fieldName) || fieldName,
            value,
          });
        }
      });

      return items;
    })();

    switch (entityType) {
      case ProviderEntityType.Deal: {
        const deal = entity as ProviderDeal;

        const weightedValue = deal && deal.amount !== undefined && probability !== undefined
          ? Number(deal.amount) * Number(probability)
          : undefined;

        const weightedValueFormatted = weightedValue !== undefined
          ? new Intl.NumberFormat(
            'en-US',
            { style: 'currency', currency: (entity as ProviderDeal).currency || 'USD' },
          ).format(weightedValue)
          : '\u2014';

        return {
          infoItems: [...commonItems, ...dynamicItems],
          metricItems: {
            title: 'Key Metrics',
            items: [
              [
                {
                  label: getPropertyLabel('closeDate'),
                  value: closeDate ? formatDate(closeDate) : '\u2014',
                },
                {
                  label: getPropertyLabel('probability'),
                  value: probability !== undefined ? `${(probability || 0) * 100}%` : '\u2014',
                },
              ],
              [
                {
                  label: 'Owner',
                  value: owner ? getOwnerDisplayString(owner, false) || '\u2014' : '\u2014',
                },
                {
                  label: 'Weighted Value',
                  value: weightedValueFormatted,
                },
              ],
            ] as MetricItem[][],
          } as Metrics,
        };
      }
      case ProviderEntityType.Contact:
      case ProviderEntityType.Company: {
        return {
          infoItems: [...commonItems, ...dynamicItems] as InfoItem[],
        };
      }
      case ProviderEntityType.Page: {
        const page = entity as ProviderPage;
        const pageInfoItems = [...commonItems];

        if (page.properties) {
          Object.entries(page.properties).forEach(([key, prop]) => {
            const value = formatNotionProperty(prop);
            if (value) {
              pageInfoItems.push({ label: key, value });
            }
          });
        }

        if (page.publicUrl) {
          pageInfoItems.push({
            label: 'Public Link',
            value: (
              <a
                href={page.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--color-primary)' } as any}
              >
                Open
              </a>
            ),
          });
        }

        if (page.url) {
          pageInfoItems.push({
            label: 'Notion Link',
            value: (
              <a
                href={page.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--color-primary)' } as any}
              >
                Open in Notion
              </a>
            ),
          });
        }

        return {
          infoItems: pageInfoItems,
        };
      }
      default:
        return {};
    }
  }, [
    entity,
    entityType,
    integration?.provider.icon_url,
    integration?.provider.display_name,
    integration?.provider.name,
    closeDate,
    probability,
    loadingState,
    loadTelebizEntity,
    oldLang,
    selectedRelationship,
    getPropertyLabel,
    formatPropertyValue,
  ]);

  const upcomingMeetings = entity?.associations?.meetings?.filter((m: ProviderMeeting) => {
    return (m.status === ProviderMeetingStatus.Scheduled || m.status === ProviderMeetingStatus.Rescheduled)
      && new Date(m.startDate) > new Date();
  });

  const nextTasks = entity?.associations?.tasks?.filter((t: ProviderTask) => {
    return (t.status === 'NOT_STARTED');
  }).sort((a: ProviderTask, b: ProviderTask) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  }).slice(0, 2);

  const notes = entity?.associations?.notes?.sort((a: ProviderNote, b: ProviderNote) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }).slice(0, 2);

  const earliestMeeting = upcomingMeetings?.reduce((earliest: ProviderMeeting, current: ProviderMeeting) => {
    return new Date(current.startDate) < new Date(earliest.startDate) ? current : earliest;
  }, upcomingMeetings[0]);

  const recentDeals = entity?.associations?.deals?.sort((a: ProviderDeal, b: ProviderDeal) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }).slice(0, 2);

  const recentContacts = entity?.associations?.contacts?.sort((a: ProviderContact, b: ProviderContact) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }).slice(0, 2);

  const recentCompanies = entity?.associations?.companies?.sort((a: ProviderCompany, b: ProviderCompany) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }).slice(0, 2);

  return (
    <RelationshipTabContainer>
      {metricItems && <RelationshipTabMetrics metrics={metricItems} />}
      {infoItems && (
        <section className={relationshipStyles.section}>
          {infoItems?.map((item) => (
            <InfoItemComponent key={item.label} {...item} />
          ))}
        </section>
      )}
      {
        recentDeals && recentDeals.length > 0 && (
          <RelationshipEntityList
            items={recentDeals.map((deal: ProviderDeal) => ({ ...deal, entityType: ProviderEntityType.Deal }))}
            title="Recent Deals"
          />
        )
      }
      {
        recentContacts && recentContacts.length > 0 && (
          <RelationshipEntityList
            items={recentContacts.map((contact: ProviderContact) => ({
              ...contact,
              entityType: ProviderEntityType.Contact,
              onEntitySelected: () => onEntitySelected(contact, ProviderEntityType.Contact),
            }))}
            title="Recent Contacts"
          />
        )
      }
      {
        recentCompanies && recentCompanies.length > 0 && (
          <RelationshipEntityList
            items={recentCompanies.map((company: ProviderCompany) => ({
              ...company,
              entityType: ProviderEntityType.Company,
              onEntitySelected: () => onEntitySelected(company, ProviderEntityType.Company),
            }))}
            title="Recent Companies"
          />
        )
      }
      {
        notes && notes.length > 0 && (
          <RelationshipEntityList
            items={notes.map((note: ProviderNote) => ({ ...note, entityType: ProviderEntityType.Note }))}
            title="Recent Notes"
          />
        )
      }
      {
        earliestMeeting && (
          <RelationshipEntityList
            items={[{ ...earliestMeeting, entityType: ProviderEntityType.Meeting }]}
            title="Upcoming Meeting"
          />
        )
      }
      {
        nextTasks && (
          <RelationshipEntityList
            items={nextTasks.map((task: ProviderTask) => ({ ...task, entityType: ProviderEntityType.Task }))}
            title="Your Next Tasks"
          />
        )
      }
      {
        entityType === ProviderEntityType.Page && entity && 'blocks' in entity && entity.blocks && integration && (
          <NotionBlocks
            blocks={entity.blocks}
            pageId={entity.id}
            integrationId={integration.id}
          />
        )
      }
      {
        entity?.metadata?.activities && entity?.metadata?.activities.length > 0 && (
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Activity</h4>
            <div className={styles.activityList}>
              {entity?.metadata?.activities?.map((activity: ProviderActivity) => (
                <div key={activity.timestamp} className={styles.activityItem}>
                  <div className={styles.activityItemTime}>
                    {new Date(activity.timestamp).toLocaleString()}
                    {' \u2022 '}
                    {activity.type}
                  </div>
                  <div className={styles.activityItemValue}>
                    {`Changed ${activity.type} to ${activity.value}`}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      }
    </RelationshipTabContainer>
  );
});

export default memo(withGlobal<OwnProps>(
  (global, { entityType }): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};
    const selectedRelationship = chatId ? selectTelebizSelectedRelationship(global, chatId) : undefined;
    const properties = selectedRelationship && entityType ?
      selectTelebizPropertiesByEntityType(global, selectedRelationship.integration_id, entityType) : [];

    return {
      selectedRelationship,
      loadingState: selectTelebizEntityLoadingState(global),
      properties,
    };
  },
)(RelationshipOverview));
