import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './BotTrustModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const BotTrustModalAsync: FC<OwnProps> = (props) => {
  const { bot } = props;
  const BotTrustModal = useModuleLoader(Bundles.Extra, 'BotTrustModal', !bot);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return BotTrustModal ? <BotTrustModal {...props} /> : undefined;
};

export default BotTrustModalAsync;
