import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './HistoryCalendar';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const HistoryCalendarAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const HistoryCalendar = useModuleLoader(Bundles.Extra, 'HistoryCalendar', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return HistoryCalendar ? <HistoryCalendar {...props} /> : undefined;
};

export default HistoryCalendarAsync;
