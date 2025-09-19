import type { FC } from '../../lib/teact/teact';
import { memo, useCallback } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { selectTabState } from '../../global/selectors';

import useOldLang from '../../hooks/useOldLang';

import CalendarModal from '../common/CalendarModal';

export type OwnProps = {
  isOpen: boolean;
};

type StateProps = {
  selectedAt?: number;
};

const HistoryCalendar: FC<OwnProps & StateProps> = ({
  isOpen, selectedAt,
}) => {
  const { searchMessagesByDate, closeHistoryCalendar } = getActions();

  const handleJumpToDate = useCallback((date: Date) => {
    searchMessagesByDate({ timestamp: date.getTime() / 1000 });
    closeHistoryCalendar();
  }, [closeHistoryCalendar, searchMessagesByDate]);

  const lang = useOldLang();

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
  (global): Complete<StateProps> => {
    return { selectedAt: selectTabState(global).historyCalendarSelectedAt };
  },
)(HistoryCalendar));
