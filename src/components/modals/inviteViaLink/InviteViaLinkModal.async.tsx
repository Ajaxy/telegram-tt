import type { OwnProps } from './InviteViaLinkModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const InviteViaLinkModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const InviteViaLinkModal = useModuleLoader(Bundles.Extra, 'InviteViaLinkModal', !modal);

  return InviteViaLinkModal ? <InviteViaLinkModal {...props} /> : undefined;
};

export default InviteViaLinkModalAsync;
