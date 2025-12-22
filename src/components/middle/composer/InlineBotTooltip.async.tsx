import type { OwnProps } from './InlineBotTooltip';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const InlineBotTooltipAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const InlineBotTooltip = useModuleLoader(Bundles.Extra, 'InlineBotTooltip', !isOpen);

  return InlineBotTooltip ? <InlineBotTooltip {...props} /> : undefined;
};

export default InlineBotTooltipAsync;
