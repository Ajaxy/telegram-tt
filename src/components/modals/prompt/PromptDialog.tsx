import React, { memo, useState } from '../../../lib/teact/teact';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import InputText from '../../ui/InputText';
import Modal from '../../ui/Modal';

import styles from './PromptDialog.module.scss';

export type OwnProps = {
  isOpen: boolean;
  title: string;
  subtitle?: React.ReactNode;
  placeholder: string;
  submitText?: string;
  maxLength?: number;
  initialValue?: string;
  onClose: NoneToVoidFunction;
  onSubmit: (text: string) => void;
};

const PromptDialog = ({
  isOpen,
  title,
  subtitle,
  placeholder,
  submitText,
  maxLength,
  initialValue = '',
  onClose,
  onSubmit,
}: OwnProps) => {
  const lang = useLang();

  const [text, setText] = useState(initialValue);

  const handleTextChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  });

  const handleSubmit = useLastCallback(() => {
    onSubmit(text);
  });

  return (
    <Modal
      className="narrow"
      title={title}
      isOpen={isOpen}
      onClose={onClose}
      isSlim
    >
      {Boolean(subtitle) && (
        <div className={styles.subtitle}>
          {subtitle}
        </div>
      )}
      <InputText
        placeholder={placeholder}
        value={text}
        onChange={handleTextChange}
        maxLength={maxLength}
        teactExperimentControlled
      />
      <div className="dialog-buttons mt-2">
        <Button className="confirm-dialog-button" onClick={handleSubmit}>
          {submitText || lang('Save')}
        </Button>
        <Button className="confirm-dialog-button" isText onClick={onClose}>
          {lang('Cancel')}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(PromptDialog);
