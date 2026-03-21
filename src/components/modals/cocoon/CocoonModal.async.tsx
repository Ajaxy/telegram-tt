import type { OwnProps } from './CocoonModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const CocoonModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const CocoonModal = useModuleLoader(Bundles.Extra, 'CocoonModal', !modal);

  return CocoonModal ? <CocoonModal {...props} /> : undefined;
};

export default CocoonModalAsync;
