import type { OwnProps } from './HistoryCalendar';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const HistoryCalendarAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const HistoryCalendar = useModuleLoader(Bundles.Extra, 'HistoryCalendar', !isOpen);

  return HistoryCalendar ? <HistoryCalendar {...props} /> : undefined;
};

export default HistoryCalendarAsync;
