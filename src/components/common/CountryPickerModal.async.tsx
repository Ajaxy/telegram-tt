import type { FC } from '../../lib/teact/teact';

import type { OwnProps } from './CountryPickerModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const CountryPickerModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const CountryPickerModal = useModuleLoader(Bundles.Extra, 'CountryPickerModal', !isOpen);

  return CountryPickerModal ? <CountryPickerModal {...props} /> : undefined;
};

export default CountryPickerModalAsync;
