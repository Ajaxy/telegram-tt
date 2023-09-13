import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './BotCommandMenu';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const BotCommandMenuAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const BotCommandMenu = useModuleLoader(Bundles.Extra, 'BotCommandMenu', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return BotCommandMenu ? <BotCommandMenu {...props} /> : undefined;
};

export default BotCommandMenuAsync;
