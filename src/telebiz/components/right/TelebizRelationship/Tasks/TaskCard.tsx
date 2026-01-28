import { memo, useRef } from '@teact';

import { ProviderEntityType, type ProviderTask } from '../../../../services/types';

import buildClassName from '../../../../../util/buildClassName';
import { formatDateTime } from '../../../../util/dates';
import { getOwnerDisplayString } from '../../../../util/general';

import useContextMenuHandlers from '../../../../../hooks/useContextMenuHandlers';

import ItemStatusChip from '../EntityStatusChip';
import RelationshipItemContextMenu from '../RelationshipEntityContextMenu';

import commonItemCardStyles from '../RelationshipEntityCard.module.scss';
import styles from './Tasks.module.scss';

interface Props {
  task: ProviderTask;
}

const getColorAndLabelByTaskDate = (date: string) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();

  const taskTime = new Date(date).getTime();

  if (taskTime < startOfToday) {
    return { color: 'red', label: 'Overdue' }; // overdue
  } else if (taskTime < endOfToday) {
    return { color: 'green', label: 'Due Today' }; // due today
  } else {
    return { color: 'white', label: 'Open' }; // future
  }
};

const getTaskTypeString = (type: ProviderTask['taskType']) => {
  switch (type) {
    case 'EMAIL':
      return 'Email';
    case 'CALL':
      return 'Call';
    case 'TODO':
      return 'To-do';
    default:
      return 'To-do';
  }
};

const TaskCard = ({ task }: Props) => {
  const { color: taskStateColor, label: taskStateLabel } = getColorAndLabelByTaskDate(task.date);
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
      className={buildClassName(commonItemCardStyles.item, styles.item, styles[taskStateColor])}
      onContextMenu={handleContextMenu}
      ref={ref}
    >
      <div className={commonItemCardStyles.itemHeader}>
        <div className={commonItemCardStyles.itemText}>
          {formatDateTime(task.date)}
        </div>
        <ItemStatusChip
          label={taskStateLabel}
          color={taskStateColor}
        />
      </div>
      {
        task.subject && (
          <div className={commonItemCardStyles.itemBody}>
            <p className={commonItemCardStyles.itemHighlight}>{task.subject}</p>
          </div>
        )
      }
      {
        task.body && (
          <div className={commonItemCardStyles.itemBody}>
            <div className={commonItemCardStyles.itemHighlight} dangerouslySetInnerHTML={{ __html: task.body }} />
          </div>
        )
      }
      <div className={commonItemCardStyles.itemFooter}>
        {task.taskType && (
          <span className={commonItemCardStyles.itemType}>
            {getTaskTypeString(task.taskType)}
          </span>
        )}
        {task.taskType && task.owner && ' • '}
        {task.owner && (
          <span className={commonItemCardStyles.itemOwner}>
            Owner:
            {' '}
            {getOwnerDisplayString(task.owner)}
          </span>
        )}
      </div>
      {contextMenuAnchor && (
        <RelationshipItemContextMenu
          type={ProviderEntityType.Task}
          triggerRef={ref}
          entity={task}
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

export default memo(TaskCard);
