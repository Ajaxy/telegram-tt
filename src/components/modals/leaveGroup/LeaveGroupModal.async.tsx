import type { OwnProps } from './LeaveGroupModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const LeaveGroupModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const LeaveGroupModal = useModuleLoader(Bundles.Extra, 'LeaveGroupModal', !modal);

  return LeaveGroupModal ? <LeaveGroupModal key={modal?.chatId} {...props} /> : undefined;
};

export default LeaveGroupModalAsync;
