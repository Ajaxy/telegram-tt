import React, { FC, memo } from '../../../lib/teact/teact';
import { OwnProps } from './MentionTooltip';
import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const MentionTooltipAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const MentionTooltip = useModuleLoader(Bundles.Extra, 'MentionTooltip', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return MentionTooltip ? <MentionTooltip {...props} /> : undefined;
};

export default memo(MentionTooltipAsync);
