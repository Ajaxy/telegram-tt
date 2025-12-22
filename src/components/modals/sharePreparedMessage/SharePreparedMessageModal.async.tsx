import type { OwnProps } from './SharePreparedMessageModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const SharePreparedMessageModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const SharePreparedMessageModal = useModuleLoader(Bundles.Extra, 'SharePreparedMessageModal', !modal);

  return SharePreparedMessageModal ? <SharePreparedMessageModal {...props} /> : undefined;
};

export default SharePreparedMessageModalAsync;
