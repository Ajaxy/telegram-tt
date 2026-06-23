import { memo, useMemo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { ensureProtocol } from '../../util/browser/url';
import renderText from '../common/helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import Modal, {
  ModalFooterActions,
  ModalHeader,
  ModalTitle,
} from '@gili/modal/Modal';

export type OwnProps = {
  modal: string;
  isOpen: boolean;
};

const SafeLinkModal = ({ modal, isOpen }: OwnProps) => {
  const { toggleSafeLinkModal } = getActions();

  const lang = useLang();

  const handleOpen = useLastCallback(() => {
    window.open(ensureProtocol(modal), '_blank', 'noopener noreferrer');
    toggleSafeLinkModal({ url: undefined });
  });

  const handleDismiss = useLastCallback(() => {
    toggleSafeLinkModal({ url: undefined });
  });

  const header = useMemo(() => (
    <ModalHeader>
      <ModalTitle>{lang('OpenUrlTitle')}</ModalTitle>
    </ModalHeader>
  ), [lang]);

  return (
    <Modal
      isOpen={isOpen}
      header={header}
      width="slim"
      height="auto"
      ariaLabel={lang('OpenUrlTitle')}
      onClose={handleDismiss}
    >
      {renderText(lang('OpenUrlText', { url: modal }, { withNodes: true, withMarkdown: true }))}
      <ModalFooterActions>
        <Button isText size="smaller" color="primary" fluid onClick={handleDismiss}>
          {lang('Cancel')}
        </Button>
        <Button isText size="smaller" color="primary" fluid autoFocus onClick={handleOpen}>
          {lang('OpenUrlConfirm')}
        </Button>
      </ModalFooterActions>
    </Modal>
  );
};

export default memo(SafeLinkModal);
