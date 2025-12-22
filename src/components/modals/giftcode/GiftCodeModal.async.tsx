import type { OwnProps } from './GiftCodeModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const GiftCodeModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftCodeModal = useModuleLoader(Bundles.Extra, 'GiftCodeModal', !modal);

  return GiftCodeModal ? <GiftCodeModal {...props} /> : undefined;
};

export default GiftCodeModalAsync;
