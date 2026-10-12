import type { OwnProps } from './RequestPeerModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const RequestPeerModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const RequestPeerModal = useModuleLoader(Bundles.Extra, 'RequestPeerModal', !modal);

  return RequestPeerModal ? <RequestPeerModal {...props} /> : undefined;
};

export default RequestPeerModalAsync;
