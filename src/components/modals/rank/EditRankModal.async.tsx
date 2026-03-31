import type { OwnProps } from './EditRankModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const EditRankModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const EditRankModal = useModuleLoader(Bundles.Extra, 'EditRankModal', !modal);

  return EditRankModal ? <EditRankModal {...props} /> : undefined;
};

export default EditRankModalAsync;
