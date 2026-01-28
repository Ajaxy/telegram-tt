import type { RefObject } from 'react';
import { memo, useRef } from '../../../../../lib/teact/teact';
import { getActions } from '../../../../../global';

import type { IAnchorPosition } from '../../../../../types';
import type { ProviderEntityType } from '../../../../services';

import { ASSOCIATED_ENTITY_TYPES, type ProviderEntity } from '../../../../services';

import useLastCallback from '../../../../../hooks/useLastCallback';

import Menu from '../../../../../components/ui/Menu';
import MenuItem from '../../../../../components/ui/MenuItem';

interface OwnProps {
  type: ProviderEntityType;
  triggerRef: RefObject<HTMLElement | undefined>;
  entity: ProviderEntity;
  rootElementClassName: string;
  isContextMenuOpen: boolean;
  contextMenuAnchor: IAnchorPosition;
  handleContextMenuClose: () => void;
  handleContextMenuHide: () => void;
}

const RelationshipEntityContextMenu = ({
  type,
  triggerRef,
  entity,
  rootElementClassName,
  isContextMenuOpen,
  contextMenuAnchor,
  handleContextMenuClose,
  handleContextMenuHide,
}: OwnProps) => {
  const { openTelebizEntityModal, openTelebizConfirmDeleteDialog } = getActions();

  const menuRef = useRef<HTMLDivElement>();
  const getTriggerElement = useLastCallback(() => triggerRef.current);
  const getRootElement = useLastCallback(() =>
    triggerRef.current?.closest(rootElementClassName));
  const getMenuElement = useLastCallback(() => {
    return document.querySelector('#portals')?.querySelector(`.${type}-context-menu .bubble`);
  });

  const getLayout = useLastCallback(() => ({ withPortal: true, shouldAvoidNegativePosition: true }));

  return (
    <>
      <Menu
        isOpen={isContextMenuOpen}
        anchor={contextMenuAnchor}
        onClose={handleContextMenuClose}
        onCloseAnimationEnd={handleContextMenuHide}
        ref={menuRef}
        getTriggerElement={getTriggerElement}
        getRootElement={getRootElement}
        getMenuElement={getMenuElement}
        autoClose
        className={`${type}-context-menu`}
        getLayout={getLayout}
        withPortal
      >
        {
          entity?.metadata?.static ? (
            <MenuItem
              icon="info"
              disabled
            >
              Not editable
            </MenuItem>
          ) : (
            <>
              <MenuItem
                icon="edit"
                onClick={() => {
                  openTelebizEntityModal({
                    type,
                    isExisting: true,
                    entity,
                  });
                  handleContextMenuClose();
                  handleContextMenuHide();
                }}
              >
                Edit
              </MenuItem>
              <MenuItem
                icon="delete"
                destructive
                onClick={() => {
                  openTelebizConfirmDeleteDialog({ entityId: entity.id, entityType: type });
                }}
              >
                {ASSOCIATED_ENTITY_TYPES.includes(type) ? 'Remove' : 'Delete'}
              </MenuItem>
            </>
          )
        }
      </Menu>
    </>
  );
};

export default memo(RelationshipEntityContextMenu);
