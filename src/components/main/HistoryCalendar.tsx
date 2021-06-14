import React, { FC, memo, useCallback } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';

import { pick } from '../../util/iteratees';
import useLang from '../../hooks/useLang';

import CalendarModal from '../common/CalendarModal';

export type OwnProps = {
  isOpen: boolean;
};

type StateProps = {
  selectedAt?: number;
};

type DispatchProps = Pick<GlobalActions, 'searchMessagesByDate' | 'closeHistoryCalendar'>;

const HistoryCalendar: FC<OwnProps & StateProps & DispatchProps> = ({
  isOpen, selectedAt, searchMessagesByDate, closeHistoryCalendar,
}) => {
  const handleJumpToDate = useCallback((date: Date) => {
    searchMessagesByDate({ timestamp: date.valueOf() / 1000 });
    closeHistoryCalendar();
  }, [closeHistoryCalendar, searchMessagesByDate]);

  const lang = useLang();

  return (
    <CalendarModal
      isOpen={isOpen}
      selectedAt={selectedAt}
      isPastMode
      submitButtonLabel={lang('JumpToDate')}
      onClose={closeHistoryCalendar}
      onSubmit={handleJumpToDate}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      selectedAt: global.historyCalendarSelectedAt,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'searchMessagesByDate', 'closeHistoryCalendar',
  ]),
)(HistoryCalendar));
