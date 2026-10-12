import { memo, useEffect } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ChatCalendar } from '../../types/chatCalendar';

import { selectCurrentMessageList, selectTabState } from '../../global/selectors';

import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import CalendarModal from '../common/CalendarModal';

export type OwnProps = {
  isOpen: boolean;
};

type StateProps = {
  selectedAt?: number;
  chatId?: string;
  chatCalendar?: ChatCalendar;
};

const HistoryCalendar = ({
  isOpen, selectedAt, chatId, chatCalendar,
}: OwnProps & StateProps) => {
  const {
    searchMessagesByDate, closeHistoryCalendar, loadChatCalendar, resetChatCalendar,
  } = getActions();

  const lang = useOldLang();

  useEffect(() => {
    if (isOpen && chatId) {
      loadChatCalendar({ chatId });
    }
  }, [isOpen, chatId]);

  useEffect(() => {
    if (chatCalendar && chatCalendar.chatId !== chatId) {
      resetChatCalendar();
    }
  }, [chatId, chatCalendar]);

  const handleJumpToDate = useLastCallback((date: Date) => {
    searchMessagesByDate({ timestamp: date.getTime() / 1000 });
    closeHistoryCalendar();
  });

  const handleMonthChange = useLastCallback((monthStart: Date) => {
    if (!chatId) return;
    loadChatCalendar({ chatId, untilDate: Math.floor(monthStart.getTime() / 1000) });
  });

  const markers = chatCalendar?.chatId === chatId ? chatCalendar : undefined;

  return (
    <CalendarModal
      isOpen={isOpen}
      selectedAt={selectedAt}
      isPastMode
      submitButtonLabel={lang('JumpToDate')}
      dayMarkers={markers?.days}
      maxDayCount={markers?.maxDayCount}
      markersChatId={chatId}
      onMonthChange={handleMonthChange}
      onClose={closeHistoryCalendar}
      onSubmit={handleJumpToDate}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const tabState = selectTabState(global);
    return {
      selectedAt: tabState.historyCalendarSelectedAt,
      chatId: selectCurrentMessageList(global)?.chatId,
      chatCalendar: tabState.chatCalendar,
    };
  },
)(HistoryCalendar));
