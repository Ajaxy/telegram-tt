import type { OwnProps } from './ReactorListModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const ReactorListModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const ReactorListModal = useModuleLoader(Bundles.Extra, 'ReactorListModal', !isOpen);

  return ReactorListModal ? <ReactorListModal {...props} /> : undefined;
};

export default ReactorListModalAsync;
