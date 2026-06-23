import type { OwnProps } from './InstantViewer';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const InstantViewerAsync = (props: OwnProps) => {
  const { modal } = props;
  const InstantViewer = useModuleLoader(Bundles.Extra, 'InstantViewer', !modal);

  return InstantViewer ? <InstantViewer {...props} /> : undefined;
};

export default InstantViewerAsync;
