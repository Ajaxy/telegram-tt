import { ChangeEvent } from 'react';

import React, {
  FC, memo, useCallback, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import { ApiPhoto, ApiReportReason } from '../../api/types';

import useLang from '../../hooks/useLang';

import Modal from '../ui/Modal';
import Button from '../ui/Button';
import RadioGroup from '../ui/RadioGroup';
import InputText from '../ui/InputText';

export type OwnProps = {
  isOpen: boolean;
  subject?: 'peer' | 'messages' | 'media';
  chatId?: string;
  photo?: ApiPhoto;
  messageIds?: number[];
  onClose: () => void;
  onCloseAnimationEnd?: () => void;
};

const ReportModal: FC<OwnProps> = ({
  isOpen,
  subject = 'messages',
  chatId,
  photo,
  messageIds,
  onClose,
  onCloseAnimationEnd,
}) => {
  const {
    reportMessages,
    reportPeer,
    reportProfilePhoto,
    exitMessageSelectMode,
  } = getActions();

  const [selectedReason, setSelectedReason] = useState<ApiReportReason>('spam');
  const [description, setDescription] = useState('');

  const handleReport = useCallback(() => {
    switch (subject) {
      case 'messages':
        reportMessages({ messageIds, reason: selectedReason, description });
        exitMessageSelectMode();
        break;
      case 'peer':
        reportPeer({ chatId, reason: selectedReason, description });
        break;
      case 'media':
        reportProfilePhoto({
          chatId, photo, reason: selectedReason, description,
        });
        break;
    }
    onClose();
  }, [
    description,
    exitMessageSelectMode,
    messageIds,
    photo,
    onClose,
    reportMessages,
    selectedReason,
    chatId,
    reportProfilePhoto,
    reportPeer,
    subject,
  ]);

  const handleSelectReason = useCallback((value: string) => {
    setSelectedReason(value as ApiReportReason);
  }, []);

  const handleDescriptionChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setDescription(e.target.value);
  }, []);

  const lang = useLang();

  const REPORT_OPTIONS: { value: ApiReportReason; label: string }[] = useMemo(() => [
    { value: 'spam', label: lang('lng_report_reason_spam') },
    { value: 'violence', label: lang('lng_report_reason_violence') },
    { value: 'pornography', label: lang('lng_report_reason_pornography') },
    { value: 'childAbuse', label: lang('lng_report_reason_child_abuse') },
    { value: 'copyright', label: lang('ReportPeer.ReasonCopyright') },
    { value: 'illegalDrugs', label: 'Illegal Drugs' },
    { value: 'personalDetails', label: 'Personal Details' },
    { value: 'other', label: lang('lng_report_reason_other') },
  ], [lang]);

  if (
    (subject === 'messages' && !messageIds)
    || (subject === 'peer' && !chatId)
    || (subject === 'media' && (!chatId || !photo))
  ) {
    return undefined;
  }

  const title = subject === 'messages'
    ? lang('lng_report_message_title')
    : lang('ReportPeer.Report');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onEnter={isOpen ? handleReport : undefined}
      onCloseAnimationEnd={onCloseAnimationEnd}
      className="report"
      title={title}
    >
      <RadioGroup
        name="report-message"
        options={REPORT_OPTIONS}
        onChange={handleSelectReason}
        selected={selectedReason}
      />
      <InputText
        label={lang('lng_report_reason_description')}
        value={description}
        onChange={handleDescriptionChange}
      />
      <Button color="danger" className="confirm-dialog-button" isText onClick={handleReport}>
        {lang('lng_report_button')}
      </Button>
      <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
    </Modal>
  );
};

export default memo(ReportModal);
