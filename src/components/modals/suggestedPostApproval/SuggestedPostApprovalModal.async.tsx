import type { OwnProps } from './SuggestedPostApprovalModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const SuggestedPostApprovalModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const SuggestedPostApprovalModal = useModuleLoader(Bundles.Extra, 'SuggestedPostApprovalModal', !modal);

  return SuggestedPostApprovalModal ? <SuggestedPostApprovalModal {...props} /> : undefined;
};

export default SuggestedPostApprovalModalAsync;
