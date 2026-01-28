import {
  memo,
  useCallback,
  useMemo,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';
import { selectTelebizTabList } from '../../../global';

import type { Integration, Property, ProviderEntityTab, ProviderRelationship } from '../../../services/types';
import { TelebizPanelScreens } from '../types';

import { PROVIDER_TYPE_TO_TAB_MAP } from '../../../config/constants';
import { ProviderEntityType } from '../../../services';

import useOldLang from '../../../../hooks/useOldLang';

import Menu from '../../../../components/ui/Menu';
import MenuItem from '../../../../components/ui/MenuItem';

const CAN_ADD_CONTACT = [ProviderEntityType.Deal, ProviderEntityType.Company];
const CAN_ADD_COMPANY = [ProviderEntityType.Deal, ProviderEntityType.Contact];
const CAN_ADD_TASK = [ProviderEntityType.Contact, ProviderEntityType.Deal, ProviderEntityType.Company];
const CAN_ADD_MEETING = [ProviderEntityType.Contact, ProviderEntityType.Deal, ProviderEntityType.Company];

interface StateProps {
  tabList: ProviderEntityTab[];
}

type OwnProps = {
  isOpen: boolean;
  onClose: () => void;
  onlyItems?: boolean;
  data?: Record<string, string>;
  selectedRelationship?: ProviderRelationship;
  isAddingRelationship?: boolean;
  selectedIntegrationId?: number;
  integrations?: Integration[];
  properties?: Property[];
};

const AddRelationshipMenu = ({
  isOpen,
  onClose,
  onlyItems,
  data,
  selectedRelationship,
  tabList,
}: OwnProps & StateProps) => {
  const {
    openTelebizPanelScreen,
    openTelebizEntityModal,
    setTelebizActiveTab,
  } = getActions();

  const lang = useOldLang();

  const displayEntityModal = useCallback((
    type: ProviderEntityType,
    entity: { title?: string; body?: string; subject?: string },
  ) => {
    openTelebizEntityModal({
      type,
      entity,
      isExisting: false,
    });
    onClose();
  }, [openTelebizEntityModal, onClose]);

  const selectActiveTabByEntity = useCallback((tab: ProviderEntityTab | number) => {
    setTelebizActiveTab({ tabIndex: typeof tab === 'number' ? tab : tabList?.indexOf(tab) || 0 });
  }, [setTelebizActiveTab, tabList]);

  const menuItems = useMemo(() => (
    <>
      <MenuItem
        icon="stickers"
        onClick={() => {
          selectActiveTabByEntity(PROVIDER_TYPE_TO_TAB_MAP[ProviderEntityType.Note]);
          displayEntityModal(
            ProviderEntityType.Note,
            { body: data?.text || '' },
          );
        }}
      >
        Add Note
      </MenuItem>
      {CAN_ADD_TASK.includes(selectedRelationship?.entity_type as ProviderEntityType) && (
        <MenuItem
          icon="message-read"
          onClick={() => {
            selectActiveTabByEntity(PROVIDER_TYPE_TO_TAB_MAP[ProviderEntityType.Task]);
            displayEntityModal(
              ProviderEntityType.Task,
              { subject: data?.text || '' },
            );
          }}
        >
          Add Task
        </MenuItem>
      )}
      {CAN_ADD_MEETING.includes(selectedRelationship?.entity_type as ProviderEntityType) && (
        <MenuItem
          icon="calendar"
          onClick={() => {
            selectActiveTabByEntity(PROVIDER_TYPE_TO_TAB_MAP[ProviderEntityType.Meeting]);
            displayEntityModal(
              ProviderEntityType.Meeting,
              { title: data?.text || '' },
            );
          }}
        >
          Add Meeting
        </MenuItem>
      )}
      {CAN_ADD_CONTACT.includes(selectedRelationship?.entity_type as ProviderEntityType) && (
        <MenuItem
          icon="user"
          onClick={() => {
            openTelebizPanelScreen({ screen: TelebizPanelScreens.AddContactToEntity });
            selectActiveTabByEntity(PROVIDER_TYPE_TO_TAB_MAP[ProviderEntityType.Contact]);
            onClose();
          }}
        >
          Add Contact
        </MenuItem>
      )}
      {CAN_ADD_COMPANY.includes(selectedRelationship?.entity_type as ProviderEntityType) && (
        <MenuItem
          icon="group"
          onClick={() => {
            openTelebizPanelScreen({ screen: TelebizPanelScreens.AddCompanyToEntity });
            selectActiveTabByEntity(PROVIDER_TYPE_TO_TAB_MAP[ProviderEntityType.Company]);
            onClose();
          }}
        >
          Add Company
        </MenuItem>
      )}
    </>
  ), [selectedRelationship?.entity_type,
    displayEntityModal,
    data?.text,
    selectActiveTabByEntity,
    onClose, openTelebizPanelScreen,
  ]);

  if (onlyItems) {
    return isOpen ? menuItems : undefined;
  }

  return (
    <Menu
      isOpen={isOpen}
      positionX={lang.isRtl ? 'left' : 'right'}
      positionY="bottom"
      autoClose
      onClose={onClose}
    >
      {menuItems}
    </Menu>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      tabList: selectTelebizTabList(global),
    };
  },
)(AddRelationshipMenu));
