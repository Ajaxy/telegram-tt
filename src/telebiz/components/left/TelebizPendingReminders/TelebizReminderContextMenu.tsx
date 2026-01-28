import { memo, useRef } from '../../../../lib/teact/teact';

import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Menu from '../../../../components/ui/Menu';
import MenuItem from '../../../../components/ui/MenuItem';

export const REMINDER_CONTEXT_MENU_CLASS = 'reminder-context-menu';

type OwnProps = {
  isOpen: boolean;
  anchor?: { x: number; y: number };
  onClose: () => void;
  onCloseAnimationEnd: () => void;
  onEdit: () => void;
  getTriggerElement: () => HTMLElement | undefined;
  getRootElement: () => Element | null | undefined;
};

const TelebizReminderContextMenu = ({
  isOpen,
  anchor,
  onClose,
  onCloseAnimationEnd,
  onEdit,
  getTriggerElement,
  getRootElement,
}: OwnProps) => {
  const lang = useTelebizLang();
  const menuRef = useRef<HTMLDivElement>();

  const getMenuElement = useLastCallback(() => {
    return document.querySelector('#portals')?.querySelector(`.${REMINDER_CONTEXT_MENU_CLASS} .bubble`);
  });

  const getLayout = useLastCallback(() => ({ withPortal: true, shouldAvoidNegativePosition: true }));

  const handleEdit = useLastCallback(() => {
    onEdit();
    onClose();
  });

  if (!anchor) return undefined;

  const getRootElementAsHtml = useLastCallback(() => getRootElement() as HTMLElement | null | undefined);

  return (
    <Menu
      isOpen={isOpen}
      anchor={anchor}
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
      ref={menuRef}
      getTriggerElement={getTriggerElement}
      getRootElement={getRootElementAsHtml}
      getMenuElement={getMenuElement}
      autoClose
      className={REMINDER_CONTEXT_MENU_CLASS}
      getLayout={getLayout}
      withPortal
    >
      <MenuItem
        icon="edit"
        onClick={handleEdit}
      >
        {lang('PendingReminders.EditReminder')}
      </MenuItem>
    </Menu>
  );
};

export default memo(TelebizReminderContextMenu);
