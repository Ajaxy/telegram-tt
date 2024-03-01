import type { ChangeEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiExportedInvite } from '../../../api/types';
import { ManagementScreens } from '../../../types';

import { selectTabState } from '../../../global/selectors';
import { formatFullDate, formatTime } from '../../../util/dateFormat';
import { getServerTime } from '../../../util/serverTime';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useSyncEffect from '../../../hooks/useSyncEffect';

import CalendarModal from '../../common/CalendarModal';
import Button from '../../ui/Button';
import Checkbox from '../../ui/Checkbox';
import FloatingActionButton from '../../ui/FloatingActionButton';
import InputText from '../../ui/InputText';
import RadioGroup from '../../ui/RadioGroup';

const DEFAULT_USAGE_LIMITS = [1, 10, 100];
const DEFAULT_EXPIRE_DATE = {
  hour: 3600000,
  day: 86400000,
  week: 604800000,
};
const DEFAULT_CUSTOM_EXPIRE_DATE = DEFAULT_EXPIRE_DATE.hour;

type OwnProps = {
  chatId: string;
  onClose: NoneToVoidFunction;
  onScreenSelect: (screen: ManagementScreens) => void;
  isActive: boolean;
};

type StateProps = {
  editingInvite?: ApiExportedInvite;
};

const ManageInvite: FC<OwnProps & StateProps> = ({
  chatId,
  editingInvite,
  isActive,
  onClose,
  onScreenSelect,
}) => {
  const { editExportedChatInvite, exportChatInvite } = getActions();

  const lang = useLang();
  const [isCalendarOpened, openCalendar, closeCalendar] = useFlag();
  const [isRequestNeeded, setIsRequestNeeded] = useState(false);
  const [title, setTitle] = useState('');
  const [customExpireDate, setCustomExpireDate] = useState<number>(Date.now() + DEFAULT_CUSTOM_EXPIRE_DATE);
  const [selectedExpireOption, setSelectedExpireOption] = useState('unlimited');
  const [customUsageLimit, setCustomUsageLimit] = useState<number | undefined>(10);
  const [selectedUsageOption, setSelectedUsageOption] = useState('0');
  const [isSubmitBlocked, setIsSubmitBlocked] = useState(false);

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  useSyncEffect(([oldEditingInvite]) => {
    if (oldEditingInvite === editingInvite) return;
    if (!editingInvite) {
      setTitle('');
      setSelectedExpireOption('unlimited');
      setSelectedUsageOption('0');
      setCustomExpireDate(getServerTime() * 1000 + DEFAULT_CUSTOM_EXPIRE_DATE);
      setCustomUsageLimit(10);
      setIsRequestNeeded(false);
    } else {
      const {
        title: editingTitle, usageLimit, expireDate, isRequestNeeded: editingIsRequestNeeded,
      } = editingInvite;
      if (editingTitle) setTitle(editingTitle);
      if (usageLimit) {
        setSelectedUsageOption(DEFAULT_USAGE_LIMITS.includes(usageLimit) ? usageLimit.toString() : 'custom');
        setCustomUsageLimit(usageLimit);
      }
      if (expireDate) {
        const minSafeDate = getServerTime() + DEFAULT_CUSTOM_EXPIRE_DATE;
        setSelectedExpireOption('custom');
        setCustomExpireDate(Math.max(expireDate, minSafeDate) * 1000);
      }
      if (editingIsRequestNeeded) {
        setIsRequestNeeded(true);
      }
    }
  }, [editingInvite]);

  const handleIsRequestChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setIsRequestNeeded(e.target.checked);
  }, []);

  const handleTitleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);

  const handleCustomUsageLimitChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setCustomUsageLimit(Number.parseInt(e.target.value, 10));
  }, []);

  const handleExpireDateChange = useCallback((date: Date) => {
    setCustomExpireDate(date.getTime());
    closeCalendar();
  }, [closeCalendar]);

  const handleSaveClick = useCallback(() => {
    setIsSubmitBlocked(true);
    const usageLimit = selectedUsageOption === 'custom' ? customUsageLimit : Number(selectedUsageOption);
    let expireDate;
    switch (selectedExpireOption) {
      case 'custom':
        expireDate = getServerTime() + (customExpireDate - Date.now()) / 1000;
        break;
      case 'hour':
      case 'day':
      case 'week':
        expireDate = getServerTime() + DEFAULT_EXPIRE_DATE[selectedExpireOption] / 1000;
        break;
      case 'unlimited':
        expireDate = 0;
        break;
      default:
        expireDate = undefined;
    }

    if (editingInvite) {
      editExportedChatInvite({
        link: editingInvite.link,
        chatId,
        title,
        isRequestNeeded,
        expireDate,
        usageLimit,
      });
    } else {
      exportChatInvite({
        chatId,
        title,
        isRequestNeeded,
        expireDate,
        usageLimit,
      });
    }
    onScreenSelect(ManagementScreens.Invites);
  }, [
    chatId, customExpireDate, customUsageLimit, editExportedChatInvite, editingInvite,
    exportChatInvite, isRequestNeeded, selectedExpireOption, selectedUsageOption, title, onScreenSelect,
  ]);

  return (
    <div className="Management ManageInvite">
      <div className="custom-scroll">
        <div className="section">
          <Checkbox
            label={lang('ApproveNewMembers')}
            subLabel={lang('ApproveNewMembersDescription')}
            checked={isRequestNeeded}
            onChange={handleIsRequestChange}
          />
        </div>
        <div className="section">
          <InputText
            className="link-name"
            placeholder={lang('LinkNameHint')}
            value={title}
            onChange={handleTitleChange}
          />
          <p className="text-muted hint">{lang('LinkNameHelp')}</p>
        </div>
        <div className="section">
          <div className="section-header">{lang('LimitByPeriod')}</div>
          <RadioGroup
            name="expireOptions"
            options={[
              {
                value: 'hour',
                label: lang('Hours', 1),
              },
              {
                value: 'day',
                label: lang('Days', 1),
              },
              {
                value: 'week',
                label: lang('Weeks', 1),
              },
              {
                value: 'unlimited',
                label: lang('NoLimit'),
              },
              {
                value: 'custom',
                label: lang('lng_group_invite_expire_custom'),
              },
            ]}
            onChange={setSelectedExpireOption}
            selected={selectedExpireOption}
          />
          {selectedExpireOption === 'custom' && (
            <Button className="expire-limit" isText onClick={openCalendar}>
              {formatFullDate(lang, customExpireDate)} {formatTime(lang, customExpireDate)}
            </Button>
          )}
          <p className="text-muted hint">{lang('TimeLimitHelp')}</p>
        </div>
        {!isRequestNeeded && (
          <div className="section">
            <div className="section-header">{lang('LimitNumberOfUses')}</div>
            <RadioGroup
              name="usageOptions"
              options={[
                ...DEFAULT_USAGE_LIMITS.map((n) => ({ value: n.toString(), label: n })),
                {
                  value: '0',
                  label: lang('NoLimit'),
                },
                {
                  value: 'custom',
                  label: lang('lng_group_invite_usage_custom'),
                },
              ]}
              onChange={setSelectedUsageOption}
              selected={selectedUsageOption}
            />
            {selectedUsageOption === 'custom' && (
              <input
                className="form-control usage-limit"
                type="number"
                min="1"
                max="99999"
                value={customUsageLimit}
                onChange={handleCustomUsageLimitChange}
              />
            )}
            <p className="text-muted hint">{lang('UsesLimitHelp')}</p>
          </div>
        )}
        <FloatingActionButton
          isShown
          onClick={handleSaveClick}
          disabled={isSubmitBlocked}
          ariaLabel={editingInvite ? lang('SaveLink') : lang('CreateLink')}
        >
          <i className="icon icon-check" />
        </FloatingActionButton>
      </div>
      <CalendarModal
        isOpen={isCalendarOpened}
        isFutureMode
        withTimePicker
        onClose={closeCalendar}
        onSubmit={handleExpireDateChange}
        selectedAt={customExpireDate}
        submitButtonLabel={lang('Save')}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const { editingInvite } = selectTabState(global).management.byChatId[chatId] || {};

    return {
      editingInvite,
    };
  },
)(ManageInvite));
