import { memo } from '@teact';
import { getActions } from '../../../../../global';

import type { Integration, ProviderEntity, ProviderEntityType } from '../../../../services';
import { TelebizFeatureSection } from '../../../../global/types';

import { useTelebizLang } from '../../../../hooks/useTelebizLang';

import PeerChip from '../../../../../components/common/PeerChip';
import { IntegrationItem } from '../../TelebizIntegrationsDropdown';
import ParentEntityDetails from './ParentEntityDetails';

import styles from '../TelebizAddRelationship.module.scss';

interface OwnProps {
  chatId?: string;
  parentEntity?: ProviderEntity;
  parentEntityType?: ProviderEntityType;
  children: React.ReactNode;
  integration?: Integration;
}

const RelationshipLinkView = ({ chatId, parentEntity, parentEntityType, integration, children }: OwnProps) => {
  const { telebizOpenFeaturesModal } = getActions();
  const lang = useTelebizLang();
  const isParentEntity = Boolean(parentEntity) && Boolean(parentEntityType);

  const handleLearnMore = () => {
    telebizOpenFeaturesModal({ section: TelebizFeatureSection.CrmIntegration });
  };

  return (
    <div className={styles.selectedEntity}>
      {chatId && (
        <div className={styles.selectedEntityChat}>
          <PeerChip peerId={chatId} className={styles.selectedEntityChatPeer} />
        </div>
      )}
      {isParentEntity && (
        <ParentEntityDetails
          entity={parentEntity}
          entityType={parentEntityType}
        />
      )}
      {integration && (
        <div className={styles.integration}>
          <IntegrationItem integration={integration} />
        </div>
      )}
      {(chatId || isParentEntity) && (
        <div className={styles.divider} />
      )}
      {children}
      <div className={styles.divider} />

      <div className={styles.selectedEntityFooter}>
        <div className={styles.selectedEntityExplanation}>
          <p>
            When creating / attaching a CRM entity to your chat,
            it will be linked to a CRM entity on your selected CRM integration.
            Once you create or link a deal or contact, the chat becomes a full workspace
            where you can view and manage meetings, tasks, notes, etc.
          </p>
          <p>
            This keeps all relevant information of your business within
            the CRM accessible directly inside the chat where the conversation happens.
            making it easier to manage your business and stay organized.
          </p>
          <a
            className="text-entity-link"
            onClick={handleLearnMore}
          >
            {lang('TelebizFeatures.LearnMoreShort')}
          </a>
        </div>
      </div>
    </div>
  );
};

export default memo(RelationshipLinkView);
