import type { OwnProps } from './SendAsMenu';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const SendAsMenuAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const SendAsMenu = useModuleLoader(Bundles.Extra, 'SendAsMenu', !isOpen);

  return SendAsMenu ? <SendAsMenu {...props} /> : undefined;
};

export default SendAsMenuAsync;
