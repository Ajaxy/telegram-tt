import type { FC } from '../../lib/teact/teact';

import type { OwnProps } from './BotTrustModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const BotTrustModalAsync: FC<OwnProps> = (props) => {
  const { bot } = props;
  const BotTrustModal = useModuleLoader(Bundles.Extra, 'BotTrustModal', !bot);

  return BotTrustModal ? <BotTrustModal {...props} /> : undefined;
};

export default BotTrustModalAsync;
