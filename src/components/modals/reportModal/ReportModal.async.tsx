import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './ReportModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const ReportModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const ReportModal = useModuleLoader(Bundles.Extra, 'ReportModal', !modal);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return ReportModal ? <ReportModal {...props} /> : undefined;
};

export default ReportModalAsync;
