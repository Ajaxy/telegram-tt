import React, { FC, memo } from '../../../lib/teact/teact';
import { OwnProps } from './MentionMenu';
import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const MentionMenuAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const MentionMenu = useModuleLoader(Bundles.Extra, 'MentionMenu', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return MentionMenu ? <MentionMenu {...props} /> : undefined;
};

export default memo(MentionMenuAsync);
