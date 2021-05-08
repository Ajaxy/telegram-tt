import React, { FC, memo } from '../../../lib/teact/teact';
import { OwnProps } from './BotKeyboardMenu';
import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const BotKeyboardMenuAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const BotKeyboardMenu = useModuleLoader(Bundles.Extra, 'BotKeyboardMenu', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return BotKeyboardMenu ? <BotKeyboardMenu {...props} /> : undefined;
};

export default memo(BotKeyboardMenuAsync);
