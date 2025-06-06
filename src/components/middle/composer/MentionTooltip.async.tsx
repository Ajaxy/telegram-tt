import type { FC } from '../../../lib/teact/teact';

import type { OwnProps } from './MentionTooltip';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const MentionTooltipAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const MentionTooltip = useModuleLoader(Bundles.Extra, 'MentionTooltip', !isOpen);

  return MentionTooltip ? <MentionTooltip {...props} /> : undefined;
};

export default MentionTooltipAsync;
