import type { OwnProps } from './EmojiTooltip';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const EmojiTooltipAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const EmojiTooltip = useModuleLoader(Bundles.Extra, 'EmojiTooltip', !isOpen);

  return EmojiTooltip ? <EmojiTooltip {...props} /> : undefined;
};

export default EmojiTooltipAsync;
