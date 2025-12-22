import type { OwnProps } from './BirthdaySetupModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const BirthdaySetupModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const BirthdaySetupModal = useModuleLoader(Bundles.Extra, 'BirthdaySetupModal', !modal);

  return BirthdaySetupModal ? <BirthdaySetupModal {...props} /> : undefined;
};

export default BirthdaySetupModalAsync;
