import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './CommandMenuCalendar';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const CommandMenuCalendarAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const CommandMenuCalendar = useModuleLoader(Bundles.Extra, 'CommandMenuCalendar', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return CommandMenuCalendar ? <CommandMenuCalendar {...props} /> : undefined;
};

export default CommandMenuCalendarAsync;
