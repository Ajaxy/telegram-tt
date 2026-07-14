import {
  memo, useCallback, useRef, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { TabState } from '../../global/types';

import buildClassName from '../../util/buildClassName';

import useKeyboardListNavigation from '../../hooks/useKeyboardListNavigation';
import useLang from '../../hooks/useLang';
import useOldLang from '../../hooks/useOldLang';

import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import Modal from '../ui/Modal';

export type OwnProps = {
  modal: TabState['isBrowserCloseConfirmationModalOpen'];
};

const BrowserCloseConfirmationModal = ({
  modal,
}: OwnProps) => {
  const { closeBrowserCloseConfirmationModal, closeBrowserModal } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();

  const isOpen = Boolean(modal);

  const [shouldSkipInFuture, setShouldSkipInFuture] = useState(false);

  const containerRef = useRef<HTMLDivElement>();

  const onClose = useCallback(() => {
    closeBrowserCloseConfirmationModal({ shouldSkipInFuture });
  }, [shouldSkipInFuture]);

  const confirmHandler = useCallback(() => {
    closeBrowserModal({ shouldSkipConfirmation: true });
    closeBrowserCloseConfirmationModal({ shouldSkipInFuture });
  }, [shouldSkipInFuture]);

  const handleSelectWithEnter = useCallback((index: number) => {
    if (index === -1) confirmHandler();
  }, [confirmHandler]);

  const handleKeyDown = useKeyboardListNavigation(containerRef, isOpen, handleSelectWithEnter, '.Button');

  return (
    <Modal
      className={buildClassName('confirm')}
      title={lang('CloseBrowserTabs')}
      isOpen={isOpen}
      onClose={onClose}
    >
      <p>{lang('AreYouSureCloseBrowserTabs')}</p>
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

export default memo(BrowserCloseConfirmationModal);
