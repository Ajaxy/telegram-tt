import { memo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ProviderEntityType } from '../../../services/types';

import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import PeerChip from '../../../../components/common/PeerChip';
import Button from '../../../../components/ui/Button';

import styles from './TelebizRelationship.module.scss';

type OwnProps = {
  entityType: ProviderEntityType;
  entityId: string;
  integrationId: number;
  isCreator: boolean;
  creatorTelegramId?: string;
};

const EntityLoadError = ({
  entityType,
  entityId,
  integrationId,
  isCreator,
  creatorTelegramId,
}: OwnProps) => {
  const {
    loadTelebizEntity,
    confirmTelebizRemoveEntityFromChat,
    openChat,
  } = getActions();

  const lang = useTelebizLang();

  const handleRetry = useLastCallback(() => {
    loadTelebizEntity({
      integrationId,
      entityType,
      entityId,
      forceRefresh: true,
    });
  });

  const handleRemove = useLastCallback(() => {
    confirmTelebizRemoveEntityFromChat({ deleteFromProvider: false });
  });

  const handleCreatorClick = useLastCallback(() => {
    if (creatorTelegramId) {
      openChat({ id: creatorTelegramId });
    }
  });

  function renderCreatorInfo() {
    if (isCreator) {
      return <p className={styles.errorCreator}>{lang('EntityLoadError.AddedByYou')}</p>;
    }

    if (!creatorTelegramId) {
      return (
        <p className={styles.errorCreator}>
          {lang('EntityLoadError.AddedBy', { 0: lang('EntityLoadError.TeamMember') })}
        </p>
      );
    }

    return (
      <div className={styles.errorCreatorPeer}>
        <span>{lang('EntityLoadError.AddedByPrefix')}</span>
        <PeerChip
          peerId={creatorTelegramId}
          onClick={handleCreatorClick}
        />
      </div>
    );
  }

  return (
    <div className={styles.error}>
      <h2 className={styles.errorTitle}>{lang('EntityLoadError.Title')}</h2>
      <p className={styles.errorMessage}>{lang('EntityLoadError.Description')}</p>
      {renderCreatorInfo()}
      <div className={styles.errorActions}>
        <Button onClick={handleRetry}>
          {lang('EntityLoadError.Retry')}
        </Button>
        {isCreator && (
          <Button color="danger" onClick={handleRemove}>
            {lang('EntityLoadError.RemoveConnection')}
          </Button>
        )}
      </div>
    </div>
  );
};

export default memo(EntityLoadError);
