import {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Island from '../../gili/layout/Island';
import Button from '../../ui/Button';
import InputText from '../../ui/InputText';
import Modal, {
  ModalFooterActions,
  ModalHeader,
  ModalTitle,
} from '@gili/modal/Modal';

type OwnProps = {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
  onSubmit: (text: string, url: string) => void;
};

const RichEditorLinkModal = ({ isOpen, onClose, onSubmit }: OwnProps) => {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');

  const lang = useLang();

  const canSubmit = Boolean(text.trim() && url.trim());

  useEffect(() => {
    if (!isOpen) {
      setText('');
      setUrl('');
    }
  }, [isOpen]);

  const handleTextChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.currentTarget.value);
  });

  const handleUrlChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.currentTarget.value);
  });

  const handleSubmit = useLastCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) {
      return;
    }

    onSubmit(text, url);
  });

  const header = useMemo(() => (
    <ModalHeader>
      <ModalTitle noAutoFocus>{lang('CreateLink')}</ModalTitle>
    </ModalHeader>
  ), [lang]);

  return (
    <Modal
      isOpen={isOpen}
      header={header}
      width="slim"
      height="auto"
      ariaLabel={lang('CreateLink')}
      onClose={onClose}
    >
      <form action="" onSubmit={handleSubmit}>
        <Island>
          <InputText
            value={text}
            label={lang('Text')}
            autoFocus
            teactExperimentControlled
            onChange={handleTextChange}
          />
          <InputText
            value={url}
            label={lang('FormattingLinkUrl')}
            inputMode="url"
            noMargin
            teactExperimentControlled
            onChange={handleUrlChange}
          />
        </Island>
        <ModalFooterActions>
          <Button isText size="smaller" color="primary" fluid onClick={onClose}>
            {lang('Cancel')}
          </Button>
          <Button isText size="smaller" color="primary" fluid type="submit" disabled={!canSubmit}>
            {lang('Create')}
          </Button>
        </ModalFooterActions>
      </form>
    </Modal>
  );
};

export default memo(RichEditorLinkModal);
