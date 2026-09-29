import type { OwnProps } from './MediaEditor';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const MediaEditorAsync = (props: OwnProps) => {
  const MediaEditor = useModuleLoader(Bundles.Extra, 'MediaEditor', !props.isOpen);

  return MediaEditor ? <MediaEditor {...props} /> : undefined;
};

export default MediaEditorAsync;
