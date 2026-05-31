import { memo, useMemo } from '../../../../lib/teact/teact';

import type { ApiSticker } from '../../../../api/types';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import CustomEmojiPicker from '../../../common/CustomEmojiPicker';
import Modal, { ModalCloseButton, ModalHeader, ModalTitle } from '@gili/modal/Modal';

import styles from './AiToneEmojiPickerModal.module.scss';

export type OwnProps = {
  isOpen: boolean;
  onEmojiSelect: (emojiId: string) => void;
  onClose: NoneToVoidFunction;
};

const AiToneEmojiPickerModal = ({
  isOpen,
  onEmojiSelect,
  onClose,
}: OwnProps) => {
  const lang = useLang();

  const handleEmojiSelect = useLastCallback((sticker: ApiSticker) => {
    onEmojiSelect(sticker.id);
  });

  const renderHeader = useMemo(() => (
    <ModalHeader>
      <ModalCloseButton />
      <ModalTitle>{lang('AiToneEditorSelectEmoji')}</ModalTitle>
    </ModalHeader>
  ), [lang]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      header={renderHeader}
      ariaLabel={lang('AiToneEditorSelectEmoji')}
      width="slim"
      noScrollable
      noContentInlinePadding
      keepMounted
      contentClassName={styles.content}
    >
      <div className={styles.picker}>
        <CustomEmojiPicker
          idPrefix="ai-tone-icon-"
          loadAndPlay={isOpen}
          isHidden={!isOpen}
          noAddButton
          onCustomEmojiSelect={handleEmojiSelect}
          onDismiss={onClose}
        />
      </div>
    </Modal>
  );
};

export default memo(AiToneEmojiPickerModal);
