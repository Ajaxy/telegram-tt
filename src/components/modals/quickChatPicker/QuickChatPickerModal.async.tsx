import type { OwnProps } from './QuickChatPickerModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const QuickChatPickerModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const QuickChatPickerModal = useModuleLoader(Bundles.Extra, 'QuickChatPickerModal', !modal);

  return QuickChatPickerModal ? <QuickChatPickerModal {...props} /> : undefined;
};

export default QuickChatPickerModalAsync;
