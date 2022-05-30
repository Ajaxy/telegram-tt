import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { Bundles } from '../../util/moduleLoader';

import type { OwnProps } from './HistoryCalendar';

import useModuleLoader from '../../hooks/useModuleLoader';

const HistoryCalendarAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const HistoryCalendar = useModuleLoader(Bundles.Extra, 'HistoryCalendar', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return HistoryCalendar ? <HistoryCalendar {...props} /> : undefined;
};

export default memo(HistoryCalendarAsync);
