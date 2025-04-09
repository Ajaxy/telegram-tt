import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './SharePreparedMessageModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const SharePreparedMessageModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const SharePreparedMessageModal = useModuleLoader(Bundles.Extra, 'SharePreparedMessageModal', !modal);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return SharePreparedMessageModal ? <SharePreparedMessageModal {...props} /> : undefined;
};

export default SharePreparedMessageModalAsync;
