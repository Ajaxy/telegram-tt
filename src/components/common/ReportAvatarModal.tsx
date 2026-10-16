import { memo, useMemo, useState } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiPhoto, ApiReportReason } from '../../api/types';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import InputText from '../ui/InputText';
import Modal from '../ui/Modal';
import RadioGroup from '../ui/RadioGroup';

export type OwnProps = {
  isOpen: boolean;
  peerId?: string;
  photo?: ApiPhoto;
  onClose: () => void;
  onCloseAnimationEnd?: () => void;
};

const ReportAvatarModal = ({
  isOpen,
  peerId,
  photo,
  onClose,
  onCloseAnimationEnd,
}: OwnProps) => {
  const { reportProfilePhoto } = getActions();

  const [selectedReason, setSelectedReason] = useState<ApiReportReason>('spam');
  const [description, setDescription] = useState('');

  const handleReport = useLastCallback(() => {
    reportProfilePhoto({
      chatId: peerId, photo, reason: selectedReason, description,
    });
    onClose();
  });

  const handleSelectReason = useLastCallback((value: string) => {
    setSelectedReason(value as ApiReportReason);
  });

  const handleDescriptionChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDescription(e.target.value);
  });

  const lang = useLang();

  const REPORT_OPTIONS: { value: ApiReportReason; label: string }[] = useMemo(() => [
    { value: 'spam', label: lang('ReportReasonSpam') },
    { value: 'violence', label: lang('ReportReasonViolence') },
    { value: 'pornography', label: lang('ReportReasonPornography') },
    { value: 'childAbuse', label: lang('ReportReasonChildAbuse') },
    { value: 'copyright', label: lang('ReportPeerReasonCopyright') },
    { value: 'illegalDrugs', label: lang('ReportChatIllegalDrugs') },
    { value: 'personalDetails', label: lang('ReportChatPersonalDetails') },
    { value: 'other', label: lang('ReportReasonOther') },
  ], [lang]);

  if (!peerId || !photo) {
    return undefined;
  }

  const title = lang('ReportPeerReport');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onEnter={isOpen ? handleReport : undefined}
      onCloseAnimationEnd={onCloseAnimationEnd}
      className="narrow"
      title={title}
    >
      <RadioGroup
        className="dialog-checkbox-group"
        name="report-message"
        options={REPORT_OPTIONS}
        onChange={handleSelectReason}
        selected={selectedReason}
      />
      <InputText
        label={lang('ReportReasonDescription')}
        value={description}
        onChange={handleDescriptionChange}
      />
      <div className="dialog-buttons">
        <Button color="danger" className="confirm-dialog-button" isText onClick={handleReport}>
          {lang('ReportButton')}
        </Button>
        <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
      </div>
    </Modal>
  );
};

export default memo(ReportAvatarModal);
