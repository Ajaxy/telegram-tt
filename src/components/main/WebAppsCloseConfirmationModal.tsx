import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useRef, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import buildClassName from '../../util/buildClassName';

import useKeyboardListNavigation from '../../hooks/useKeyboardListNavigation';
import useLang from '../../hooks/useLang';
import useOldLang from '../../hooks/useOldLang';

import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import Modal from '../ui/Modal';

type OwnProps = {
  isOpen: boolean;
};

const WebAppsCloseConfirmationModal: FC<OwnProps> = ({
  isOpen,
}) => {
  const oldLang = useOldLang();
  const lang = useLang();
  const { closeWebAppsCloseConfirmationModal, closeWebAppModal } = getActions();

  const [shouldSkipInFuture, setShouldSkipInFuture] = useState(false);

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const onClose = useCallback(() => {
    closeWebAppsCloseConfirmationModal({ shouldSkipInFuture });
  }, [shouldSkipInFuture]);

  const confirmHandler = useCallback(() => {
    closeWebAppModal({ shouldSkipConfirmation: true });
    closeWebAppsCloseConfirmationModal({ shouldSkipInFuture });
  }, [shouldSkipInFuture]);

  const handleSelectWithEnter = useCallback((index: number) => {
    if (index === -1) confirmHandler();
  }, [confirmHandler]);

  const handleKeyDown = useKeyboardListNavigation(containerRef, isOpen, handleSelectWithEnter, '.Button');

  return (
    <Modal
      className={buildClassName('confirm')}
      title={lang('CloseMiniApps')}
      isOpen={isOpen}
      onClose={onClose}
    >
      <p>{lang('AreYouSureCloseMiniApps')}</p>
      <Checkbox
        className="dialog-checkbox"
        label={lang('DoNotAskAgain')}
        checked={shouldSkipInFuture}
        onCheck={setShouldSkipInFuture}
      />
      <div
        className="dialog-buttons mt-2"
        ref={containerRef}
        onKeyDown={handleKeyDown}
      >
        <Button
          className="confirm-dialog-button"
          isText
          onClick={confirmHandler}
          color="danger"
        >
          {oldLang('Confirm')}
        </Button>
        <Button className="confirm-dialog-button" isText onClick={onClose}>
          {oldLang('Cancel')}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(WebAppsCloseConfirmationModal);
