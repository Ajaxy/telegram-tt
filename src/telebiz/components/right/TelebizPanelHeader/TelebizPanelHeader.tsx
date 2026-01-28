import { memo, useMemo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { Integration, ProviderRelationship } from '../../../services/types';

import { selectCurrentMessageList } from '../../../../global/selectors';
import {
  selectTelebizIntegrationsList,
  selectTelebizIsAddingRelationship,
  selectTelebizSelectedIntegrationId,
  selectTelebizSelectedRelationship,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import styles from './TelebizPanelHeader.module.scss';

interface OwnProps {
  title: string;
  withIntegrationIcon?: boolean;
  ctaButton?: React.ReactNode;
}

type StateProps = {
  selectedRelationship?: ProviderRelationship;
  selectedIntegrationId?: number;
  isAddingRelationship: boolean;
  integrations: Integration[];
};

const TelebizPanelHeader = ({
  title,
  selectedRelationship,
  selectedIntegrationId,
  isAddingRelationship,
  integrations,
  withIntegrationIcon = false,
  ctaButton,
}: OwnProps & StateProps) => {
  const integration = useMemo(() => {
    const integrationId = isAddingRelationship || !selectedRelationship
      ? selectedIntegrationId
      : selectedRelationship?.integration_id;
    return integrations.find((it) => it.id === integrationId);
  }, [integrations, selectedRelationship, selectedIntegrationId, isAddingRelationship]);

  return (
    <div className={styles.container}>
      <h3 className={buildClassName('title', styles.header)}>
        {integration && withIntegrationIcon && (
          <div className={styles.headerIcon}>
            <img
              src={integration?.provider.icon_url}
              alt={integration?.provider.display_name}
            />
          </div>
        )}
        <span className={styles.headerName}>
          {title}
        </span>
      </h3>
      <div className={styles.headerActions}>
        {ctaButton}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};

    return {
      selectedRelationship: chatId ? selectTelebizSelectedRelationship(global, chatId) : undefined,
      selectedIntegrationId: selectTelebizSelectedIntegrationId(global),
      isAddingRelationship: selectTelebizIsAddingRelationship(global),
      integrations: selectTelebizIntegrationsList(global),
    };
  },
)(TelebizPanelHeader));
