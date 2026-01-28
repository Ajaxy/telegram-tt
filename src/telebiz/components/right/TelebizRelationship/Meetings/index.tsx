import { memo, useMemo } from '@teact';

import { ProviderEntityType, type ProviderMeeting, ProviderMeetingStatus } from '../../../../services/types';

import { splitByDate } from '../../../../util/dates';

import EmptyEntityList from '../EmptyEntityList';
import RelationshipEntityList from '../RelationshipEntityList';
import RelationshipTabContainer from '../RelationshipTabContainer';
import RelationshipTabMetrics, { type MetricItem } from '../RelationshipTabMetrics';

interface Props {
  meetings: ProviderMeeting[];
}

const RelationshipMeetings = ({ meetings }: Props) => {
  const { canceled, upcoming, past } = useMemo(() => {
    const { ca, rest } = meetings ? meetings.reduce<{ ca: ProviderMeeting[]; rest: ProviderMeeting[] }>(
      (acc, meeting) => {
        if (meeting.status === ProviderMeetingStatus.Canceled) {
          acc.ca.push(meeting);
        } else {
          acc.rest.push(meeting);
        }
        return acc;
      },
      { ca: [], rest: [] },
    ) : { ca: [], rest: [] };
    const [older, newer] = splitByDate({ items: rest, dateField: 'startDate' });
    return { upcoming: newer, past: older, canceled: ca };
  }, [meetings]);

  const metrics = useMemo(() => {
    return {
      title: 'Meetings Summary',
      items: [[
        {
          label: 'Upcoming',
          value: upcoming.length || 0,
        },
        {
          label: 'Past (30d)',
          value: past.length,
        },
        {
          label: 'Canceled',
          value: canceled.length,
        },
      ]] as MetricItem[][],
    };
  }, [upcoming.length, past.length, canceled.length]);

  return (
    <RelationshipTabContainer>
      {!meetings || meetings.length === 0 ? (
        <EmptyEntityList entityType={ProviderEntityType.Meeting} />
      ) : (
        <>
          <RelationshipTabMetrics metrics={metrics} />
          {upcoming.length > 0 && (
            <RelationshipEntityList
              items={upcoming.map((meeting) => ({ ...meeting, entityType: ProviderEntityType.Meeting }))}
              title="Upcoming"
            />
          )}
          {past.length > 0 && (
            <RelationshipEntityList
              items={past.map((meeting) => ({ ...meeting, entityType: ProviderEntityType.Meeting }))}
              title="Past (30d)"
            />
          )}
        </>
      )}
    </RelationshipTabContainer>
  );
};

export default memo(RelationshipMeetings);
