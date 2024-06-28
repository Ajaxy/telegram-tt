import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './ReportAdModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const ReportAdModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const ReportAdModal = useModuleLoader(Bundles.Extra, 'ReportAdModal', !modal);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return ReportAdModal ? <ReportAdModal {...props} /> : undefined;
};

export default ReportAdModalAsync;
