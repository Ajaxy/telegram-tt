import type { OwnProps } from './UnpinAllMessagesModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const UnpinAllMessagesModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const UnpinAllMessagesModal = useModuleLoader(Bundles.Extra, 'UnpinAllMessagesModal', !isOpen);

  return UnpinAllMessagesModal ? <UnpinAllMessagesModal {...props} /> : undefined;
};

export default UnpinAllMessagesModalAsync;
