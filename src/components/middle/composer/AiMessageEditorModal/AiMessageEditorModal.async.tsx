import type { OwnProps } from './AiMessageEditorModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const AiMessageEditorModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const AiMessageEditorModal = useModuleLoader(Bundles.Extra, 'AiMessageEditorModal', !modal);

  return AiMessageEditorModal ? <AiMessageEditorModal {...props} /> : undefined;
};

export default AiMessageEditorModalAsync;
