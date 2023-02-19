import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import renderText from './helpers/renderText';
import useLang from '../../hooks/useLang';

import Modal from '../ui/Modal';
import Button from '../ui/Button';
import SafeLink from './SafeLink';

export type OwnProps = {
  isOpen: boolean;
  onClose: () => void;
};

const AboutAdsModal: FC<OwnProps> = ({
  isOpen,
  onClose,
}) => {
  const lang = useLang();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      hasCloseButton
      title={lang('SponsoredMessageInfo')}
    >
      <p>{renderText(lang('SponsoredMessageInfoDescription1'), ['br'])}</p>
      <p>{renderText(lang('SponsoredMessageInfoDescription2'), ['br'])}</p>
      <p>{renderText(lang('SponsoredMessageInfoDescription3'), ['br'])}</p>
      <p>
        <SafeLink
          url={lang('SponsoredMessageAlertLearnMoreUrl')}
          text={lang('SponsoredMessageAlertLearnMoreUrl')}
        />
      </p>
      <p>{renderText(lang('SponsoredMessageInfoDescription4'), ['br'])}</p>
      <div className="dialog-buttons mt-2">
        <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Close')}</Button>
      </div>
    </Modal>
  );
};

export default memo(AboutAdsModal);
