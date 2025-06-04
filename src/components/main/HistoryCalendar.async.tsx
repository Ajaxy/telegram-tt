import type { FC } from '../../lib/teact/teact';

import type { OwnProps } from './HistoryCalendar';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const HistoryCalendarAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const HistoryCalendar = useModuleLoader(Bundles.Extra, 'HistoryCalendar', !isOpen);

  return HistoryCalendar ? <HistoryCalendar {...props} /> : undefined;
};

export default HistoryCalendarAsync;
