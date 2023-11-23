/* eslint-disable react/self-closing-comp */
import React, {
  memo, useCallback, useMemo, useState,
} from 'react';
import type { FC } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { MAX_INT_32 } from '../../config';

import useLang from '../../hooks/useLang.react';

import Button from '../ui/Button.react';
import Modal from '../ui/Modal.react';
import RadioGroup from '../ui/RadioGroup.react';

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

  const lang = useLang();

  const muteForOptions = useMemo(() => [
    { label: lang('MuteFor.Hours', 1), value: MuteDuration.OneHour },
    { label: lang('MuteFor.Hours', 4), value: MuteDuration.FourHours },
    { label: lang('MuteFor.Hours', 8), value: MuteDuration.EightHours },
    { label: lang('MuteFor.Days', 1), value: MuteDuration.OneDay },
    { label: lang('MuteFor.Days', 3), value: MuteDuration.ThreeDays },
    { label: lang('MuteFor.Forever'), value: MuteDuration.Forever },
  ], [lang]);

  const handleSubmit = useCallback(() => {
    let muteUntil: number;
    if (muteUntilOption === MuteDuration.Forever) {
      muteUntil = MAX_INT_32;
    } else {
      muteUntil = Math.floor(Date.now() / 1000) + Number(muteUntilOption);
    }
    if (topicId) {
      updateTopicMutedState({ chatId, topicId, muteUntil });
    } else {
      updateChatMutedState({ chatId, muteUntil });
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
        name="muteFor"
        options={muteForOptions}
        selected={muteUntilOption}
        onChange={setMuteUntilOption as any}
      />
      <div className="dialog-buttons">
        <Button color="primary" className="confirm-dialog-button" onClick={handleSubmit}>
          {lang('Common.Done')}
          <div className="hotkey-frame">
            <div className="hotkey-icon"></div>
          </div>
        </Button>
        <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
      </div>
    </Modal>
  );
};

export default memo(MuteChatModal);
