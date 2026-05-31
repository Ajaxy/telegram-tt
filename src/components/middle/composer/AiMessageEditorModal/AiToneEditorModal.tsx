import { memo, useEffect, useMemo, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiAiComposeTone } from '../../../../api/types';

import { selectTabState } from '../../../../global/selectors';
import { getInputTone } from '../../../../util/aiComposeTones';
import buildClassName from '../../../../util/buildClassName';

import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import CustomEmoji from '../../../common/CustomEmoji';
import Icon from '../../../common/icons/Icon';
import CheckboxField from '../../../gili/templates/CheckboxField';
import Button from '../../../ui/Button';
import ConfirmDialog from '../../../ui/ConfirmDialog';
import InputText from '../../../ui/InputText';
import TextArea from '../../../ui/TextArea';
import AiToneEmojiPickerModal from './AiToneEmojiPickerModal.async';
import Island from '@gili/layout/Island';
import Modal, { ModalCloseButton, ModalHeader, ModalTitle } from '@gili/modal/Modal';

import styles from './AiToneEditorModal.module.scss';

const EMOJI_SIZE = 48;
const DEFAULT_TITLE_MAX_LENGTH = 12;
const DEFAULT_PROMPT_MAX_LENGTH = 1024;

type OwnProps = {
  isOpen: boolean;
};

type StateProps = {
  toneToEdit?: ApiAiComposeTone;
  titleMaxLength?: number;
  promptMaxLength?: number;
};

const AiToneEditorModal = ({
  isOpen,
  toneToEdit,
  titleMaxLength = DEFAULT_TITLE_MAX_LENGTH,
  promptMaxLength = DEFAULT_PROMPT_MAX_LENGTH,
}: OwnProps & StateProps) => {
  const {
    closeAiToneEditorModal,
    createAiTone,
    updateAiTone,
    deleteAiTone,
  } = getActions();

  const lang = useLang();

  const isEditMode = Boolean(toneToEdit);

  const [emojiId, setEmojiId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [shouldDisplayAuthor, setShouldDisplayAuthor] = useState(false);
  const [isEmojiPickerOpen, openEmojiPicker, closeEmojiPicker] = useFlag();
  const [isDeleteConfirmOpen, openDeleteConfirm, closeDeleteConfirm] = useFlag();

  useEffect(() => {
    if (!isOpen) return;
    if (toneToEdit) {
      setEmojiId(toneToEdit.emojiId);
      setTitle(toneToEdit.title);
      setPrompt(toneToEdit.prompt || '');
      setShouldDisplayAuthor(Boolean(toneToEdit.authorId));
    } else {
      setEmojiId(undefined);
      setTitle('');
      setPrompt('');
      setShouldDisplayAuthor(false);
    }
  }, [isOpen, toneToEdit]);

  const canSubmit = Boolean(emojiId && title.trim() && prompt.trim());

  const handleClose = useLastCallback(() => {
    closeAiToneEditorModal();
    closeEmojiPicker();
    closeDeleteConfirm();
  });

  const handleSubmit = useLastCallback(() => {
    if (!canSubmit) return;

    if (isEditMode) {
      const tone = getInputTone(toneToEdit);
      updateAiTone({
        tone,
        title: title.trim(),
        emojiId: emojiId!,
        prompt: prompt.trim(),
        shouldDisplayAuthor: shouldDisplayAuthor || undefined,
      });
    } else {
      createAiTone({
        title: title.trim(),
        emojiId: emojiId!,
        prompt: prompt.trim(),
        shouldDisplayAuthor: shouldDisplayAuthor || undefined,
      });
    }
    handleClose();
  });

  const handleDelete = useLastCallback(() => {
    if (!toneToEdit) return;
    const tone = getInputTone(toneToEdit);
    deleteAiTone({ tone });
    closeDeleteConfirm();
    handleClose();
  });

  const handleTitleChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  });

  const handlePromptChange = useLastCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  });

  const handleEmojiSelect = useLastCallback((emojiDocumentId: string) => {
    setEmojiId(emojiDocumentId);
    closeEmojiPicker();
  });

  const modalTitle = lang(isEditMode ? 'AiToneEditorEditTitle' : 'AiToneEditorTitle');

  const renderHeader = useMemo(() => (
    <ModalHeader>
      <ModalCloseButton />
      <ModalTitle>{modalTitle}</ModalTitle>
    </ModalHeader>
  ), [modalTitle]);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        header={renderHeader}
        ariaLabel={modalTitle}
        width="slim"
      >
        <div className={styles.emojiRow}>
          <button
            type="button"
            className={styles.emojiButton}
            onClick={openEmojiPicker}
          >
            {emojiId ? (
              <CustomEmoji documentId={emojiId} size={EMOJI_SIZE} />
            ) : (
              <Icon name="smile" className={styles.emojiPlaceholderIcon} />
            )}
          </button>
        </div>

        <Island>
          <InputText
            className={styles.input}
            value={title}
            onChange={handleTitleChange}
            placeholder={lang('AiToneEditorNamePlaceholder')}
            maxLength={titleMaxLength}
            hasLengthIndicator
          />

          <TextArea
            className={buildClassName(styles.input, styles.promptInput)}
            value={prompt}
            onChange={handlePromptChange}
            placeholder={lang('AiToneEditorPromptPlaceholder')}
            maxLength={promptMaxLength}
            hasLengthIndicator
            noReplaceNewlines
          />
        </Island>

        <Island>
          <CheckboxField
            label={lang('AiToneEditorDisplayAuthor')}
            checked={shouldDisplayAuthor}
            isRound
            isCentered
            onChange={setShouldDisplayAuthor}
          />
        </Island>

        <div className={styles.footer}>
          {isEditMode && (
            <Button
              className={styles.deleteButton}
              onClick={openDeleteConfirm}
              color="danger"
              isText
            >
              {lang('AiToneDeleteStyle')}
            </Button>
          )}
          <Button
            className={styles.createButton}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {lang(isEditMode ? 'Save' : 'Create')}
          </Button>
        </div>
      </Modal>

      <AiToneEmojiPickerModal
        isOpen={isEmojiPickerOpen}
        onEmojiSelect={handleEmojiSelect}
        onClose={closeEmojiPicker}
      />

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        title={lang('AiToneDeleteStyle')}
        text={lang('AiToneDeleteStyleConfirm')}
        confirmLabel={lang('Delete')}
        confirmIsDestructive
        onClose={closeDeleteConfirm}
        confirmHandler={handleDelete}
      />
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      toneToEdit: selectTabState(global).aiToneEditorModal?.toneToEdit,
      titleMaxLength: global.appConfig.aiComposeToneTitleLengthMax,
      promptMaxLength: global.appConfig.aiComposeTonePromptLengthMax,
    };
  },
)(AiToneEditorModal));
