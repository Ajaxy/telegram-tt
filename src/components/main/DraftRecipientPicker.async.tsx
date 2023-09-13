import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './DraftRecipientPicker';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const DraftRecipientPickerAsync: FC<OwnProps> = (props) => {
  const { requestedDraft } = props;
  const DraftRecipientPicker = useModuleLoader(Bundles.Extra, 'DraftRecipientPicker', !requestedDraft);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return DraftRecipientPicker ? <DraftRecipientPicker {...props} /> : undefined;
};

export default DraftRecipientPickerAsync;
