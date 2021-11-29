import React, { FC, memo } from '../../lib/teact/teact';
import useModuleLoader from '../../hooks/useModuleLoader';
import { Bundles } from '../../util/moduleLoader';

type OwnProps = {
  isOpen: boolean;
};

const CallFallbackConfirmAsync: FC<OwnProps> = ({ isOpen }) => {
  const CallFallbackConfirm = useModuleLoader(Bundles.Calls, 'CallFallbackConfirm', !isOpen);

  return CallFallbackConfirm ? <CallFallbackConfirm isOpen={isOpen} /> : undefined;
};

export default memo(CallFallbackConfirmAsync);
