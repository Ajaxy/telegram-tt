import { memo, useEffect, useMemo, useRef, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { TelebizLangPack } from '../../../lang/telebizLangPack';
import type {
  Integration,
  ProviderCompany,
  ProviderContact,
  ProviderDeal,
  ProviderEntity,
  ProviderPage,
  ProviderRelationship,
} from '../../../services/types';
import { ProviderEntityTab, ProviderEntityType } from '../../../services/types';

import { selectCurrentMessageList } from '../../../../global/selectors';
import {
  selectTelebizActiveTab,
  selectTelebizEntity,
  selectTelebizEntityLoadError,
  selectTelebizIntegrationsList,
  selectTelebizSelectedRelationship,
  selectTelebizTabList,
} from '../../../global/selectors';
import { selectTelebizUser } from '../../../global/selectors/auth';
import { selectTelebizOrganizationMemberByUserId } from '../../../global/selectors/organizations';
import { IS_TOUCH_ENV } from '../../../../util/browser/windowEnvironment';

import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Loading from '../../../../components/ui/Loading';
import TabList from '../../../../components/ui/TabList';
import Transition from '../../../../components/ui/Transition';
import AddRelationshipButton from '../TelebizAddRelationshipButton';
import TelebizIntegrationNotAvailable from '../TelebizIntegrationNotAvailable';
import RelationshipCompanies from './Companies';
import RelationshipContacts from './Contacts';
import RelationshipDeals from './Deals';
import EntityLoadError from './EntityLoadError';
import RelationshipHeader from './Header';
import RelationshipMeetings from './Meetings';
import RelationshipNotes from './Notes';
import RelationshipContent from './NotionBlocks/RelationshipContent';
import RelationshipOverview from './Overview';
import RelationshipTasks from './Tasks';

import styles from './TelebizRelationship.module.scss';

interface OwnProps {
  isMobile?: boolean;
  onEntitySelected: (entity: ProviderContact | ProviderDeal | ProviderCompany, entityType: ProviderEntityType) => void;
}

type StateProps = {
  integrations: Integration[];
  selectedRelationship?: ProviderRelationship;
  activeTab: number;
  tabList: ProviderEntityTab[];
  selectedEntity?: ProviderEntity;
  entityLoadError?: {
    integrationId: number;
    entityType: ProviderEntityType;
    entityId: string;
    message: string;
  };
  currentUserId?: number;
  creatorTelegramId?: string;
};

const BUTTON_CLOSE_DELAY_MS = 250;
let closeTimeout: number | undefined;

const TelebizRelationship = ({
  isMobile,
  onEntitySelected,
  integrations,
  selectedRelationship,
  activeTab,
  tabList,
  selectedEntity,
  entityLoadError,
  currentUserId,
  creatorTelegramId,
}: OwnProps & StateProps) => {
  const {
    setTelebizActiveTab,
    loadTelebizProviderProperties,
    loadTelebizEntity,
  } = getActions();

  const lang = useTelebizLang();

  const [isNewRelationshipButtonShown, setIsNewRelationshipButtonShown] = useState(IS_TOUCH_ENV);

  const selectedIntegration = useMemo(() => {
    return integrations.find((i) => i.id === selectedRelationship?.integration_id);
  }, [integrations, selectedRelationship]);

  // Load pipelines and properties for the integration
  useEffect(() => {
    if (selectedRelationship?.integration_id) {
      loadTelebizProviderProperties({ integrationId: selectedRelationship.integration_id });
    }
  }, [selectedRelationship?.integration_id]);

  // Auto-refresh entity if stale (older than 5 minutes)
  useEffect(() => {
    if (!selectedRelationship) return;

    loadTelebizEntity({
      integrationId: selectedRelationship.integration_id,
      entityType: selectedRelationship.entity_type,
      entityId: selectedRelationship.entity_id,
    });
  }, [
    selectedRelationship,
    selectedEntity,
    loadTelebizEntity,
  ]);

  const renderingActiveTab = activeTab > tabList.length - 1 ? tabList.length - 1 : activeTab;
  const tabType = tabList[renderingActiveTab];

  const isMouseInside = useRef(false);

  const handleMouseEnter = useLastCallback(() => {
    isMouseInside.current = true;
    setIsNewRelationshipButtonShown(true);
  });

  const handleMouseLeave = useLastCallback(() => {
    isMouseInside.current = false;

    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = undefined;
    }

    closeTimeout = window.setTimeout(() => {
      if (!isMouseInside.current) {
        setIsNewRelationshipButtonShown(false);
      }
    }, BUTTON_CLOSE_DELAY_MS);
  });

  useEffect(() => {
    return () => {
      if (closeTimeout) {
        clearTimeout(closeTimeout);
        closeTimeout = undefined;
      }
    };
  }, []);

  useEffect(() => {
    let autoCloseTimeout: number | undefined;
    if (!isMouseInside.current && !IS_TOUCH_ENV) {
      autoCloseTimeout = window.setTimeout(() => {
        setIsNewRelationshipButtonShown(false);
      }, BUTTON_CLOSE_DELAY_MS);
    } else if (isMouseInside.current || IS_TOUCH_ENV) {
      setIsNewRelationshipButtonShown(true);
    }

    return () => {
      if (autoCloseTimeout) {
        clearTimeout(autoCloseTimeout);
        autoCloseTimeout = undefined;
      }
    };
  }, []);

  function renderContent() {
    if (!selectedEntity) return undefined;
    switch (tabType) {
      case ProviderEntityTab.Overview:
        return (
          <RelationshipOverview
            integration={selectedIntegration as Integration}
            entity={selectedEntity}
            closeDate={(selectedEntity as ProviderDeal)?.closeDate}
            probability={(selectedEntity as ProviderDeal)?.probability}
            entityType={selectedRelationship?.entity_type}
            onEntitySelected={onEntitySelected}
          />
        );
      case ProviderEntityTab.Deals:
        return (
          <RelationshipDeals deals={selectedEntity.associations?.deals || []} />
        );
      case ProviderEntityTab.Meetings:
        return (
          <RelationshipMeetings meetings={selectedEntity.associations?.meetings || []} />
        );
      case ProviderEntityTab.Notes:
        return (
          <RelationshipNotes notes={selectedEntity.associations?.notes || []} />
        );
      case ProviderEntityTab.Tasks:
        return (
          <RelationshipTasks tasks={selectedEntity.associations?.tasks || []} />
        );
      case ProviderEntityTab.Contacts:
        return (
          <RelationshipContacts
            contacts={selectedEntity.associations?.contacts || []}
            onContactSelected={(contact) => onEntitySelected(contact, ProviderEntityType.Contact)}
          />
        );
      case ProviderEntityTab.Companies:
        return (
          <RelationshipCompanies
            companies={selectedEntity.associations?.companies || []}
            onCompanySelected={(company: ProviderCompany) => onEntitySelected(company, ProviderEntityType.Company)}
          />
        );
      case ProviderEntityTab.Content:
        return (
          <RelationshipContent
            entity={selectedEntity as ProviderPage}
            integration={selectedIntegration as Integration}
          />
        );
      default:
        return undefined;
    }
  }

  const getBadgeCount = (tab: ProviderEntityTab) => {
    if (!selectedEntity) return 0;
    switch (tab) {
      case ProviderEntityTab.Deals:
        return selectedEntity.associations?.deals?.length;
      case ProviderEntityTab.Contacts:
        return selectedEntity.associations?.contacts?.length;
      case ProviderEntityTab.Companies:
        return selectedEntity.associations?.companies?.length;
      case ProviderEntityTab.Meetings:
        return selectedEntity.associations?.meetings?.length;
      case ProviderEntityTab.Notes:
        return selectedEntity.associations?.notes?.length;
      case ProviderEntityTab.Tasks:
        return selectedEntity.associations?.tasks?.length;
      default:
        return 0;
    }
  };

  const handleSwitchTab = useLastCallback((tabIndex: number) => {
    setTelebizActiveTab({ tabIndex });
  });

  if (!selectedRelationship?.integration_id) {
    return <TelebizIntegrationNotAvailable integration={selectedRelationship?.integration} />;
  }

  // Check if there's an error for the current entity
  const hasEntityLoadError = entityLoadError
    && entityLoadError.integrationId === selectedRelationship.integration_id
    && entityLoadError.entityType === selectedRelationship.entity_type
    && entityLoadError.entityId === selectedRelationship.entity_id;

  if (hasEntityLoadError) {
    const isCreator = currentUserId === selectedRelationship.user_id;
    return (
      <EntityLoadError
        entityType={selectedRelationship.entity_type}
        entityId={selectedRelationship.entity_id}
        integrationId={selectedRelationship.integration_id}
        isCreator={isCreator}
        creatorTelegramId={creatorTelegramId}
      />
    );
  }

  if (selectedRelationship && !selectedEntity) {
    return <Loading />;
  }

  if (!selectedEntity) return undefined;

  return (
    <div
      className={styles.container}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
    >
      {selectedRelationship && (
        <RelationshipHeader
          entity={selectedEntity}
          entityType={selectedRelationship.entity_type}
          integrationId={selectedIntegration?.id}
          integration={selectedIntegration}
          isMobile={isMobile}
        />
      )}
      <div className={styles.content}>
        <TabList
          activeTab={renderingActiveTab}
          tabs={tabList.map((tab, index) => ({
            id: index,
            title: lang(`RelationshipPanel.${tab.toLowerCase()}` as keyof TelebizLangPack),
            badgeCount: getBadgeCount(tab) || undefined,
          }))}
          onSwitchTab={handleSwitchTab}
        />
        <Transition
          name="slideOptimized"
          activeKey={renderingActiveTab}
          renderCount={tabList.length}
          className={styles.transition}
        >
          {renderContent()}
        </Transition>
      </div>

      <AddRelationshipButton
        isShown={isNewRelationshipButtonShown}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};
    const selectedRelationship = chatId ? selectTelebizSelectedRelationship(global, chatId) : undefined;
    const currentUser = selectTelebizUser(global);

    let selectedEntity: ProviderEntity | undefined;
    if (selectedRelationship) {
      selectedEntity = selectTelebizEntity(
        global,
        selectedRelationship.integration_id,
        selectedRelationship.entity_type,
        selectedRelationship.entity_id,
      );
    }

    // Get creator's telegram_id from organization members
    let creatorTelegramId: string | undefined;
    if (selectedRelationship?.user_id) {
      const creatorMember = selectTelebizOrganizationMemberByUserId(global, selectedRelationship.user_id);
      creatorTelegramId = creatorMember?.telegram_id;
    }

    return {
      integrations: selectTelebizIntegrationsList(global),
      selectedRelationship,
      activeTab: selectTelebizActiveTab(global),
      tabList: selectTelebizTabList(global),
      selectedEntity,
      entityLoadError: selectTelebizEntityLoadError(global),
      currentUserId: currentUser?.id,
      creatorTelegramId,
    };
  },
)(TelebizRelationship));
