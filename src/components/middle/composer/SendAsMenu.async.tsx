import type { FC } from '../../../lib/teact/teact';

import type { OwnProps } from './SendAsMenu';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const SendAsMenuAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const SendAsMenu = useModuleLoader(Bundles.Extra, 'SendAsMenu', !isOpen);

  return SendAsMenu ? <SendAsMenu {...props} /> : undefined;
};

export default SendAsMenuAsync;
