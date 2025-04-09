import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { ensureProtocol } from '../../util/browser/url';
import renderText from '../common/helpers/renderText';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useLang from '../../hooks/useLang';

import ConfirmDialog from '../ui/ConfirmDialog';

export type OwnProps = {
  url?: string;
};

const SafeLinkModal: FC<OwnProps> = ({ url }) => {
  const { toggleSafeLinkModal } = getActions();

  const lang = useLang();

  const handleOpen = useCallback(() => {
    if (!url) {
      return;
    }

    window.open(ensureProtocol(url), '_blank', 'noopener noreferrer');
    toggleSafeLinkModal({ url: undefined });
  }, [toggleSafeLinkModal, url]);

  const handleDismiss = useCallback(() => {
    toggleSafeLinkModal({ url: undefined });
  }, [toggleSafeLinkModal]);

  const renderingUrl = useCurrentOrPrev(url);

  return (
    <ConfirmDialog
      isOpen={Boolean(url)}
      onClose={handleDismiss}
      title={lang('OpenUrlTitle')}
      textParts={renderText(lang('OpenUrlText', { url: renderingUrl }, { withNodes: true, withMarkdown: true }))}
      confirmLabel={lang('OpenUrlConfirm')}
      confirmHandler={handleOpen}
    />
  );
};

export default memo(SafeLinkModal);
