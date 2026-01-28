import { memo, useRef } from '@teact';

import { ProviderEntityType, type ProviderMeeting, type ProviderMeetingStatus } from '../../../../services/types';

import buildClassName from '../../../../../util/buildClassName';
import { formatDateTime } from '../../../../util/dates';
import { getOwnerDisplayString } from '../../../../util/general';

import useContextMenuHandlers from '../../../../../hooks/useContextMenuHandlers';

import Icon from '../../../../../components/common/icons/Icon';
import ItemStatusChip from '../EntityStatusChip';
import RelationshipItemContextMenu from '../RelationshipEntityContextMenu';

import commonItemCardStyles from '../RelationshipEntityCard.module.scss';
import styles from './Meetings.module.scss';

interface Props {
  meeting: ProviderMeeting;
}

const getColorByMeetingStatusAndDate = (status: ProviderMeetingStatus, date: string) => {
  // for now this is only based on the date, but will be based on the status soon
  const now = new Date().getTime();
  if (new Date(date).getTime() > now) { // future meeting
    return 'green';
  } else { // past meetings
    return 'gray';
  }
};

const MeetingCard = ({ meeting }: Props) => {
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

  const color = getColorByMeetingStatusAndDate(meeting.status, meeting.startDate);

  return (
    <div
      ref={ref}
      className={buildClassName(commonItemCardStyles.item, styles.item, styles[color])}
      onContextMenu={handleContextMenu}
    >
      <div className={commonItemCardStyles.itemHeader}>
        <div className={commonItemCardStyles.itemHeaderTitle}>
          <Icon name="calendar" className={styles.calendarIcon} />
          <div className={commonItemCardStyles.itemHighlight}>
            {formatDateTime(meeting.startDate)}
          </div>
        </div>
        <ItemStatusChip
          label={meeting.status.replace('_', ' ')}
          color={color}
        />
      </div>
      <div className={commonItemCardStyles.itemBody}>
        <p className={commonItemCardStyles.itemText}>
          {meeting.title}
          {meeting.owner && (
            <span className={commonItemCardStyles.itemOwner}>
              {` • Owner: ${getOwnerDisplayString(meeting.owner)}`}
            </span>
          )}
        </p>
        <p className={commonItemCardStyles.itemText}>
          {meeting.attendees && (
            <>
              Attendees:
              {' '}
              {meeting.attendees.join(', ')}
            </>
          )}
          {meeting.attendees && meeting.externalUrl && <>{' • '}</>}
          {meeting.externalUrl && (
            <a href={meeting.externalUrl} target="_blank" rel="noreferrer">Open</a>
          )}
        </p>
      </div>
      {contextMenuAnchor && (
        <RelationshipItemContextMenu
          type={ProviderEntityType.Meeting}
          triggerRef={ref}
          entity={meeting}
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

export default memo(MeetingCard);
