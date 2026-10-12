import type { OwnProps } from './MusicPickerModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const MusicPickerModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const MusicPickerModal = useModuleLoader(Bundles.Extra, 'MusicPickerModal', !isOpen);

  return MusicPickerModal ? <MusicPickerModal {...props} /> : undefined;
};

export default MusicPickerModalAsync;
