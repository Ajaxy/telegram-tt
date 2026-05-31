import type { OwnProps } from './AiToneEmojiPickerModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const AiToneEmojiPickerModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const AiToneEmojiPickerModal = useModuleLoader(Bundles.Extra, 'AiToneEmojiPickerModal', !isOpen);

  return AiToneEmojiPickerModal ? <AiToneEmojiPickerModal {...props} /> : undefined;
};

export default AiToneEmojiPickerModalAsync;
