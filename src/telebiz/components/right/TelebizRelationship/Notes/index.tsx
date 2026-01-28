import { memo, useMemo } from '@teact';

import { ProviderEntityType, type ProviderNote } from '../../../../services/types';

import { splitByDate, subtractDays } from '../../../../util/dates';

import EmptyEntityList from '../EmptyEntityList';
import RelationshipEntityList from '../RelationshipEntityList';
import RelationshipTabContainer from '../RelationshipTabContainer';
import RelationshipTabMetrics, { type MetricItem } from '../RelationshipTabMetrics';

interface Props {
  notes: ProviderNote[];
}

const RelationshipNotes = ({ notes }: Props) => {
  const { past30, previous } = useMemo(() => {
    const [older, newer] = splitByDate({
      items: notes,
      dateField: 'date',
      splitDate: subtractDays(new Date(), 30).toISOString(),
    });
    return { past30: newer, previous: older };
  }, [notes]);

  const metrics = useMemo(() => {
    return {
      title: 'Notes Summary',
      items: [[
        {
          label: 'Total',
          value: notes?.length || 0,
        },
        {
          label: 'Last 30d',
          value: past30.length,
        },
      ]] as MetricItem[][],
    };
  }, [notes, past30.length]);

  return (
    <RelationshipTabContainer>
      {!notes || notes.length === 0 ? <EmptyEntityList entityType={ProviderEntityType.Note} /> : (
        <>
          <RelationshipTabMetrics metrics={metrics} />
          {past30.length > 0 && (
            <RelationshipEntityList
              items={past30.map((note) => ({ ...note, entityType: ProviderEntityType.Note }))}
              title="Recent (Last 30d)"
            />
          )}
          {previous.length > 0 && (
            <RelationshipEntityList
              items={previous.map((note) => ({ ...note, entityType: ProviderEntityType.Note }))}
              title="Older"
            />
          )}
        </>
      )}
    </RelationshipTabContainer>
  );
};

export default memo(RelationshipNotes);
