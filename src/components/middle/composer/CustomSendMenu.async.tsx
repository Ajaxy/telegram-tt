import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './CustomSendMenu';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const CustomSendMenuAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const CustomSend = useModuleLoader(Bundles.Extra, 'CustomSendMenu', !isOpen);

  return CustomSend ? <CustomSend {...props} /> : undefined;
};

export default CustomSendMenuAsync;
