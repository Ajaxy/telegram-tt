import type { OwnProps } from './DisableSharingAboutModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const DisableSharingAboutModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const DisableSharingAboutModal = useModuleLoader(Bundles.Extra, 'DisableSharingAboutModal', !modal);

  return DisableSharingAboutModal ? <DisableSharingAboutModal {...props} /> : undefined;
};

export default DisableSharingAboutModalAsync;
