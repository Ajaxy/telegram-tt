import type { OwnProps } from './BotCreationModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const BotCreationModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const BotCreationModal = useModuleLoader(Bundles.Extra, 'BotCreationModal', !isOpen);

  return BotCreationModal ? <BotCreationModal {...props} /> : undefined;
};

export default BotCreationModalAsync;
