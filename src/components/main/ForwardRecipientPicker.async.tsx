import type { OwnProps } from './ForwardRecipientPicker';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const ForwardRecipientPickerAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const ForwardRecipientPicker = useModuleLoader(Bundles.Extra, 'ForwardRecipientPicker', !isOpen);

  return ForwardRecipientPicker ? <ForwardRecipientPicker {...props} /> : undefined;
};

export default ForwardRecipientPickerAsync;
