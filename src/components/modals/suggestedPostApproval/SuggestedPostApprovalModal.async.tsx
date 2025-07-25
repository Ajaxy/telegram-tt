import type { FC } from '../../../lib/teact/teact';

import type { OwnProps } from './SuggestedPostApprovalModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

import Loading from '../../ui/Loading';

const SuggestedPostApprovalModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const SuggestedPostApprovalModal = useModuleLoader(Bundles.Extra, 'SuggestedPostApprovalModal', !modal);

  return SuggestedPostApprovalModal ? <SuggestedPostApprovalModal {...props} /> : <Loading />;
};

export default SuggestedPostApprovalModalAsync;
