import type { FC } from '../../../lib/teact/teact';

import type { OwnProps } from './ToDoListModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const ToDoListModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const ToDoListModal = useModuleLoader(Bundles.Extra, 'ToDoListModal', !modal);

  return ToDoListModal ? <ToDoListModal {...props} /> : undefined;
};

export default ToDoListModalAsync;
