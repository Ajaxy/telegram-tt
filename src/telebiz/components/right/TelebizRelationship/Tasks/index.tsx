import { memo, useMemo } from '@teact';

import type { MetricItem } from '../RelationshipTabMetrics';
import { ProviderEntityType, type ProviderTask } from '../../../../services/types';

import EmptyEntityList from '../EmptyEntityList';
import RelationshipEntityList from '../RelationshipEntityList';
import RelationshipTabContainer from '../RelationshipTabContainer';
import RelationshipTabMetrics from '../RelationshipTabMetrics';

interface Props {
  tasks: ProviderTask[];
}

const RelationshipTasks = ({ tasks }: Props) => {
  const { overdue, dueToday, future, openCount, completedCount } = useMemo(() => {
    const pastTasks: ProviderTask[] = [];
    const todayTasks: ProviderTask[] = [];
    const futureTasks: ProviderTask[] = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();

    const toTime = (item: ProviderTask) => new Date(item.date).getTime();

    const todoTasks = tasks?.filter((task) => task.status === 'NOT_STARTED') || [];
    const completedTasks = tasks?.filter((task) => task.status === 'COMPLETED') || [];

    for (const item of todoTasks) {
      const time = toTime(item);
      if (time < startOfToday) {
        pastTasks.push(item);
      } else if (time >= endOfToday) {
        futureTasks.push(item);
      } else {
        todayTasks.push(item);
      }
    }

    // optional: sort each bucket if you want
    pastTasks.sort((a, b) => toTime(a) - toTime(b));
    todayTasks.sort((a, b) => toTime(a) - toTime(b));
    futureTasks.sort((a, b) => toTime(a) - toTime(b));

    return {
      overdue: pastTasks,
      dueToday: todayTasks,
      future: futureTasks,
      openCount: todoTasks.length,
      completedCount: completedTasks.length,
    };
  }, [tasks]);

  const metrics = useMemo(() => {
    return {
      title: 'Tasks Summary',
      items: [[
        {
          label: 'Open',
          value: openCount,
        },
        {
          label: 'Due Today',
          value: dueToday.length,
        },
        {
          label: 'Completed',
          value: completedCount,
        },
      ]] as MetricItem[][],
    };
  }, [openCount, dueToday, completedCount]);

  return (
    <RelationshipTabContainer>
      {!tasks || tasks.length === 0 ? <EmptyEntityList entityType={ProviderEntityType.Task} /> : (
        <>
          <RelationshipTabMetrics metrics={metrics} />
          {overdue.length > 0 && (
            <RelationshipEntityList
              items={overdue.map((task) => ({ ...task, entityType: ProviderEntityType.Task }))}
              title="Overdue"
            />
          )}
          {dueToday.length > 0 && (
            <RelationshipEntityList
              items={dueToday.map((task) => ({ ...task, entityType: ProviderEntityType.Task }))}
              title="Due Today"
            />
          )}
          {future.length > 0 && (
            <RelationshipEntityList
              items={future.map((task) => ({ ...task, entityType: ProviderEntityType.Task }))}
              title="Upcoming"
            />
          )}
        </>
      )}
    </RelationshipTabContainer>
  );
};

export default memo(RelationshipTasks);
