/* eslint-disable react/jsx-props-no-spreading */
import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './CommandMenuCalendar';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const CommandMenuCalendarAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const CommandMenuCalendar = useModuleLoader(Bundles.Extra, 'CommandMenuCalendar', !isOpen);

  // Если CommandMenuCalendar не загружен, возвращаем null или запасной компонент
  return CommandMenuCalendar ? <CommandMenuCalendar {...props} isOpen={isOpen} /> : undefined;
};

export default CommandMenuCalendarAsync;
