import React, { FC, memo } from '../../lib/teact/teact';
import { OwnProps } from './CalendarModal';
import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const CalendarModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const CalendarModal = useModuleLoader(Bundles.Extra, 'CalendarModal', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return CalendarModal ? <CalendarModal {...props} /> : undefined;
};

export default memo(CalendarModalAsync);
