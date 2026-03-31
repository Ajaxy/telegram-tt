import { type TeactNode, useMemo, useRef, useState } from '@teact';
import { getActions } from '../../global';

import { type ApiMessageEntityFormattedDate, ApiMessageEntityTypes } from '../../api/types';

import { copyTextToClipboard } from '../../util/clipboard';
import { formatDateTime, secondsToDate } from '../../util/localization/dateFormat';
import { getServerTime } from '../../util/serverTime';

import useInterval from '../../hooks/schedulers/useInterval';
import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useSchedule from '../../hooks/useSchedule';

import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';

type OwnProps = {
  children?: TeactNode;
  entity: ApiMessageEntityFormattedDate;
  asPreview?: boolean;
  chatId?: string;
  messageId?: number;
};

const FormattedDate = ({
  children,
  chatId,
  messageId,
  entity,
  asPreview,
}: OwnProps) => {
  const { showNotification, openForwardMenu, forwardToSavedMessages } = getActions();
  const [cacheBreaker, setCacheBreaker] = useState(0);

  const ref = useRef<HTMLAnchorElement>();
  const menuRef = useRef<HTMLDivElement>();

  const lang = useLang();

  const [requestCalendar, calendar] = useSchedule(undefined, undefined, entity.date);

  useInterval(
    () => setCacheBreaker((prev) => prev + 1),
    getUpdateInterval(Math.abs(entity.date - getServerTime())),
  );

  const canSetReminder = Boolean(chatId && messageId);

  const { formattedDate, canonicalDate } = useMemo(() => {
    void cacheBreaker;

    const { type, offset, length, date, ...formatOptions } = entity;
    const canonical = formatDateTime(lang, secondsToDate(date), {
      date: 'long',
      includeYear: true,
      includeDay: true,
      time: 'long',
    });

    if (Object.values(formatOptions).every((value) => value === undefined)) {
      return { formattedDate: undefined, canonicalDate: canonical };
    }

    const { relative, shortTime, longTime, shortDate, longDate, dayOfWeek } = formatOptions;

    const formatted = formatDateTime(lang, secondsToDate(date), {
      relative: relative ? 'auto' : undefined,
      time: shortTime ? 'short' : longTime ? 'long' : undefined,
      date: shortDate ? 'short' : longDate ? 'long' : undefined,
      weekday: dayOfWeek ? 'long' : undefined,
    });

    return { formattedDate: formatted, canonicalDate: canonical };
  }, [lang, entity, cacheBreaker]);

  const {
    isContextMenuOpen,
    contextMenuAnchor,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(ref, asPreview);

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => document.body);
  const getMenuElement = useLastCallback(() => menuRef.current);
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  const handleCopy = useLastCallback(() => {
    copyTextToClipboard(canonicalDate);
    showNotification({ message: lang('DateCopiedToast') });
  });

  const handleSetReminder = useLastCallback(() => {
    if (!chatId || !messageId) return;
    requestCalendar((scheduledAt) => {
      openForwardMenu({ fromChatId: chatId, messageIds: [messageId] });
      forwardToSavedMessages({ scheduledAt });
      showNotification({
        message: {
          key: 'ReminderSetToast',
          options: {
            withNodes: true,
            withMarkdown: true,
          },
        },
      });
    });
  });

  if (asPreview) {
    return formattedDate ?? children;
  }

  return (
    <a
      ref={ref}
      onClick={handleContextMenu}
      onContextMenu={handleContextMenu}
      className="text-entity-link"
      dir="auto"
      data-entity-type={ApiMessageEntityTypes.FormattedDate}
      data-unix={entity.date}
      data-format={formatToString(entity)}
      title={canonicalDate}
    >
      {formattedDate ?? children}
      <Menu
        ref={menuRef}
        isOpen={isContextMenuOpen}
        anchor={contextMenuAnchor}
        getTriggerElement={getTriggerElement}
        getRootElement={getRootElement}
        getMenuElement={getMenuElement}
        getLayout={getLayout}
        onClose={handleContextMenuClose}
        onCloseAnimationEnd={handleContextMenuHide}
        withPortal
        autoClose
      >
        <MenuItem icon="copy" onClick={handleCopy}>{lang('MenuCopyDate')}</MenuItem>
        {canSetReminder && (
          <MenuItem icon="unmute" onClick={handleSetReminder}>{lang('SetReminder')}</MenuItem>
        )}
      </Menu>
      {calendar}
    </a>
  );
};

export default FormattedDate;

function getUpdateInterval(diffInSeconds: number) {
  if (diffInSeconds < 60) {
    return 1000;
  }

  if (diffInSeconds < 60 * 60) {
    return 60000;
  }

  return undefined;
}

function formatToString(entity: ApiMessageEntityFormattedDate) {
  const { relative, shortTime, longTime, shortDate, longDate, dayOfWeek } = entity;
  return [
    relative && 'r',
    dayOfWeek && 'w',
    shortDate && 'd',
    longDate && 'D',
    shortTime && 't',
    longTime && 'T',
  ].filter(Boolean).join('');
}
