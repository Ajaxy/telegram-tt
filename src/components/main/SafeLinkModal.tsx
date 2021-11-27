import React, { FC, memo, useCallback } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';

import { pick } from '../../util/iteratees';
import { ensureProtocol } from '../../util/ensureProtocol';
import renderText from '../common/helpers/renderText';
import useLang from '../../hooks/useLang';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';

import ConfirmDialog from '../ui/ConfirmDialog';

export type OwnProps = {
  url?: string;
};

type DispatchProps = Pick<GlobalActions, 'toggleSafeLinkModal'>;

const SafeLinkModal: FC<OwnProps & DispatchProps> = ({ url, toggleSafeLinkModal }) => {
  const lang = useLang();

  const handleOpen = useCallback(() => {
    window.open(ensureProtocol(url));
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
      textParts={renderText(lang('OpenUrlAlert2', renderingUrl), ['links'])}
      confirmLabel={lang('OpenUrlTitle')}
      confirmHandler={handleOpen}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  undefined,
  (setGlobal, actions): DispatchProps => pick(actions, ['toggleSafeLinkModal']),
)(SafeLinkModal));
