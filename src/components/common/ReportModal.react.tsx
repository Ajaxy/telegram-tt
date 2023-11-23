/* eslint-disable react/self-closing-comp */
import type { ChangeEvent } from 'react';
import React, { memo, useMemo, useState } from 'react';
import type { FC } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiPhoto, ApiReportReason } from '../../api/types';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang.react';
import useLastCallback from '../../hooks/useLastCallback.react';

import Button from '../ui/Button.react';
import InputText from '../ui/InputText.react';
import Modal from '../ui/Modal.react';
import RadioGroup from '../ui/RadioGroup.react';

export type OwnProps = {
  isOpen: boolean;
  subject?: 'peer' | 'messages' | 'media' | 'story';
  peerId?: string;
  photo?: ApiPhoto;
  messageIds?: number[];
  storyId?: number;
  onClose: () => void;
  onCloseAnimationEnd?: () => void;
};

const ReportModal: FC<OwnProps> = ({
  isOpen,
  subject = 'messages',
  peerId,
  photo,
  messageIds,
  storyId,
  onClose,
  onCloseAnimationEnd,
}) => {
  const {
    reportMessages,
    reportPeer,
    reportProfilePhoto,
    reportStory,
    exitMessageSelectMode,
  } = getActions();

  const [selectedReason, setSelectedReason] = useState<ApiReportReason>('spam');
  const [description, setDescription] = useState('');

  const handleReport = useLastCallback(() => {
    switch (subject) {
      case 'messages':
        reportMessages({ messageIds: messageIds!, reason: selectedReason, description });
        exitMessageSelectMode();
        break;
      case 'peer':
        reportPeer({ chatId: peerId, reason: selectedReason, description });
        break;
      case 'media':
        reportProfilePhoto({
          chatId: peerId, photo, reason: selectedReason, description,
        });
        break;
      case 'story':
        reportStory({
          peerId: peerId!, storyId: storyId!, reason: selectedReason, description,
        });
    }
    onClose();
  });

  const handleSelectReason = useLastCallback((value: string) => {
    setSelectedReason(value as ApiReportReason);
  });

  const handleDescriptionChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    setDescription(e.target.value);
  });

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
    || (subject === 'peer' && !peerId)
    || (subject === 'media' && (!peerId || !photo))
    || (subject === 'story' && (!storyId || !peerId))
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
      className={buildClassName('narrow', subject === 'story' && 'component-theme-dark')}
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
      <div className="dialog-buttons">
        <Button color="danger" className="confirm-dialog-button" isText onClick={handleReport}>
          {lang('lng_report_button')}
          <div className="hotkey-frame">
            <div className="hotkey-icon"></div>
          </div>
        </Button>
        <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
      </div>
    </Modal>
  );
};

export default memo(ReportModal);
