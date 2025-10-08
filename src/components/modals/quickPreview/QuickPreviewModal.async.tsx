import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';

import type { OwnProps } from './QuickPreviewModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const QuickPreviewModalAsync: FC<OwnProps> = memo((props) => {
  const { modal } = props;

  const QuickPreviewModal = useModuleLoader(Bundles.Extra, 'QuickPreviewModal', !modal);

  return QuickPreviewModal ? <QuickPreviewModal {...props} /> : undefined;
});

export default QuickPreviewModalAsync;
