import type { OwnProps } from './QrCodeModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const QrCodeModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const QrCodeModal = useModuleLoader(Bundles.Extra, 'QrCodeModal', !modal);

  return QrCodeModal ? <QrCodeModal {...props} /> : undefined;
};

export default QrCodeModalAsync;
