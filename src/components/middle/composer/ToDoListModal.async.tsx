import type { OwnProps } from './ToDoListModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const ToDoListModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const ToDoListModal = useModuleLoader(Bundles.Extra, 'ToDoListModal', !modal);

  return ToDoListModal ? <ToDoListModal {...props} /> : undefined;
};

export default ToDoListModalAsync;
