import type { FC } from '../../lib/teact/teact';
import {
  memo, useCallback, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import { MUTE_INDEFINITE_TIMESTAMP } from '../../config';

import useOldLang from '../../hooks/useOldLang';

import Button from '../ui/Button';
import Modal from '../ui/Modal';
import RadioGroup from '../ui/RadioGroup';

export type OwnProps = {
  isOpen: boolean;
  chatId: string;
  topicId?: number;
  onClose: () => void;
  onCloseAnimationEnd?: () => void;
};

enum MuteDuration {
  OneHour = '3600',
  FourHours = '14400',
  EightHours = '28800',
  OneDay = '86400',
  ThreeDays = '259200',
  Forever = '-1',
}

const MuteChatModal: FC<OwnProps> = ({
  isOpen,
  chatId,
  topicId,
  onClose,
  onCloseAnimationEnd,
}) => {
  const [muteUntilOption, setMuteUntilOption] = useState(MuteDuration.Forever);
  const { updateChatMutedState, updateTopicMutedState } = getActions();

  const lang = useOldLang();

  const muteForOptions = useMemo(() => [
    { label: lang('MuteFor.Hours', 1), value: MuteDuration.OneHour },
    { label: lang('MuteFor.Hours', 4), value: MuteDuration.FourHours },
    { label: lang('MuteFor.Hours', 8), value: MuteDuration.EightHours },
    { label: lang('MuteFor.Days', 1), value: MuteDuration.OneDay },
    { label: lang('MuteFor.Days', 3), value: MuteDuration.ThreeDays },
    { label: lang('MuteFor.Forever'), value: MuteDuration.Forever },
  ], [lang]);

  const handleSubmit = useCallback(() => {
    let mutedUntil: number;
    if (muteUntilOption === MuteDuration.Forever) {
      mutedUntil = MUTE_INDEFINITE_TIMESTAMP;
    } else {
      mutedUntil = Math.floor(Date.now() / 1000) + Number(muteUntilOption);
    }
    if (topicId) {
      updateTopicMutedState({ chatId, topicId, mutedUntil });
    } else {
      updateChatMutedState({ chatId, mutedUntil });
    }
    onClose();
  }, [chatId, muteUntilOption, onClose, topicId]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
      onEnter={handleSubmit}
      className="delete"
      title={lang('Notifications')}
    >
      <RadioGroup
        className="dialog-checkbox-group"
        name="muteFor"
        options={muteForOptions}
        selected={muteUntilOption}
        onChange={setMuteUntilOption as any}
      />
      <div className="dialog-buttons">
        <Button color="primary" className="confirm-dialog-button" isText onClick={handleSubmit}>
          {lang('Common.Done')}
        </Button>
        <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
      </div>
    </Modal>
  );
};

export default memo(MuteChatModal);
