import type { OwnProps } from './ReportAdModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const ReportAdModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const ReportAdModal = useModuleLoader(Bundles.Extra, 'ReportAdModal', !modal);

  return ReportAdModal ? <ReportAdModal {...props} /> : undefined;
};

export default ReportAdModalAsync;
