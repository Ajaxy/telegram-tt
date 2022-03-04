import { ChangeEvent } from 'react';

import React, {
  FC, memo, useCallback, useState,
} from '../../lib/teact/teact';
import { getDispatch } from '../../lib/teact/teactn';

import { ApiReportReason } from '../../api/types';

import useLang from '../../hooks/useLang';

import Modal from '../ui/Modal';
import Button from '../ui/Button';
import RadioGroup from '../ui/RadioGroup';
import InputText from '../ui/InputText';

export type OwnProps = {
  isOpen: boolean;
  messageIds?: number[];
  onClose: () => void;
};

const ReportMessageModal: FC<OwnProps> = ({
  isOpen,
  messageIds,
  onClose,
}) => {
  const {
    reportMessages,
    exitMessageSelectMode,
  } = getDispatch();

  const [selectedReason, setSelectedReason] = useState<ApiReportReason>('spam');
  const [description, setDescription] = useState('');

  const handleReport = () => {
    reportMessages({ messageIds, reason: selectedReason, description });
    exitMessageSelectMode();
    onClose();
  };

  const handleSelectReason = useCallback((value: string) => {
    setSelectedReason(value as ApiReportReason);
  }, []);

  const handleDescriptionChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setDescription(e.target.value);
  }, []);

  const lang = useLang();

  const REPORT_OPTIONS: { value: ApiReportReason; label: string }[] = [
    { value: 'spam', label: lang('lng_report_reason_spam') },
    { value: 'violence', label: lang('lng_report_reason_violence') },
    { value: 'pornography', label: lang('lng_report_reason_pornography') },
    { value: 'childAbuse', label: lang('lng_report_reason_child_abuse') },
    { value: 'copyright', label: lang('ReportPeer.ReasonCopyright') },
    { value: 'illegalDrugs', label: 'Illegal Drugs' },
    { value: 'personalDetails', label: 'Personal Details' },
    { value: 'other', label: lang('lng_report_reason_other') },
  ];

  if (!messageIds) {
    return undefined;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onEnter={isOpen ? handleReport : undefined}
      className="report"
      title={lang('lng_report_message_title')}
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

export default memo(ReportMessageModal);
