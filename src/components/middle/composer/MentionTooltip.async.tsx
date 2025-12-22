import type { OwnProps } from './MentionTooltip';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const MentionTooltipAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const MentionTooltip = useModuleLoader(Bundles.Extra, 'MentionTooltip', !isOpen);

  return MentionTooltip ? <MentionTooltip {...props} /> : undefined;
};

export default MentionTooltipAsync;
