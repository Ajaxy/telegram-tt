import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './PrivacySettingsNoticeModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const PrivacySettingsNoticeModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const PrivacySettingsNoticeModal = useModuleLoader(Bundles.Extra, 'PrivacySettingsNoticeModal', !isOpen);

  return PrivacySettingsNoticeModal ? <PrivacySettingsNoticeModal {...props} /> : undefined;
};

export default PrivacySettingsNoticeModalAsync;
