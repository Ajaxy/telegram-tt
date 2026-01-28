import { memo, useCallback, useMemo } from '../../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../../global';

import type { Integration, Property, PropertyOption } from '../../../../services/types';
import {
  type ProviderDeal,
  ProviderEntityType,
  type ProviderRelationship,
} from '../../../../services/types';

import { selectCurrentMessageList } from '../../../../../global/selectors';
import { selectTelebizSelectedRelationship } from '../../../../global/selectors';
import buildClassName from '../../../../../util/buildClassName';
import { formatDateTime } from '../../../../util/dates';
import { getProviderEntityUrl } from '../../../../util/general';

import { useProviderProperty } from '../../../../hooks/useProviderProperty';

import Icon from '../../../../../components/common/icons/Icon';
import DropdownMenu from '../../../../../components/ui/DropdownMenu';
import MenuItem from '../../../../../components/ui/MenuItem';

import styles from './Header.module.scss';

interface OwnProps {
  deal?: ProviderDeal;
  isMobile?: boolean;
  integrationId?: number;
  stageClassName: string;
  loading?: boolean;
  properties: Property[];
  integration?: Integration;
}

type StateProps = {
  selectedRelationship?: ProviderRelationship;
};

const DealHeaderData = ({
  deal,
  integrationId,
  stageClassName,
  selectedRelationship,
  properties,
  integration,
}: OwnProps & StateProps) => {
  const { updateTelebizEntity } = getActions();

  const { getPropertyLabel, getPropertyOptions } = useProviderProperty(properties);

  const providerUrl = useMemo(() => {
    if (!integration?.provider?.name || !deal?.id) return undefined;
    return getProviderEntityUrl(
      integration.provider.name,
      ProviderEntityType.Deal,
      deal.id,
      integration.metadata?.user_info?.hub_id,
    );
  }, [integration, deal?.id]);

  const stageOptions = getPropertyOptions('stage') as Record<string, PropertyOption[]>;
  const pipelineOptions = getPropertyOptions('pipeline') as PropertyOption[];
  const pipelineValue = pipelineOptions.find((p) => p.value === deal?.pipeline)?.label || '';
  const stageValue = stageOptions[deal?.pipeline || '']?.find((s) => s.value === deal?.stage)?.label || '';

  const currency = deal?.currency || 'USD';

  const formattedValue = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(deal?.amount));

  const changeStage = useCallback((_stage: string) => {
    if (!integrationId || !deal || !selectedRelationship) return;
    updateTelebizEntity({
      integrationId,
      entityType: selectedRelationship.entity_type,
      entityId: deal.id,
      data: { stage: _stage },
    });
  }, [integrationId, deal, selectedRelationship, updateTelebizEntity]);

  const StageMenuButton = useMemo(() => {
    return ({ onTrigger, isOpen }: { onTrigger: () => void; isOpen?: boolean }) => (
      <div
        className={buildClassName(styles.stageMenuButton, isOpen && styles.stageMenuButtonOpen)}
        onClick={onTrigger}
        aria-label={getPropertyLabel('stage')}
      >
        <span className={buildClassName(styles.stageMenuButtonLabel, styles[stageClassName])}>
          {stageValue}
        </span>
        <Icon name="down" className={styles.stageMenuButtonIcon} />
      </div>
    );
  }, [stageClassName, stageValue, getPropertyLabel]);

  return (
    <div className={styles.metaRow}>
      {stageValue && (
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>{getPropertyLabel('stage')}</span>
          <span className={styles.metaValue}>
            <DropdownMenu
              className={styles.stageMenu}
              trigger={StageMenuButton}
              positionX="right"
            >
              {
                stageOptions[deal?.pipeline || '']?.map((stage) => (
                  <MenuItem
                    key={stage.value}
                    onClick={() => changeStage(stage.value)}
                    disabled={stage.value === deal?.stage}
                  >
                    {stage.label}
                  </MenuItem>
                ))
              }
            </DropdownMenu>
          </span>
        </div>
      )}
      {pipelineValue && (
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>{getPropertyLabel('pipeline')}</span>
          <span className={styles.metaValue}>{pipelineValue}</span>
        </div>
      )}
      {formattedValue && (
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>{getPropertyLabel('amount')}</span>
          <span className={styles.metaValue}>{formattedValue}</span>
        </div>
      )}
      {deal?.closeDate && (
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>{getPropertyLabel('closeDate')}</span>
          <span className={styles.metaValue}>{formatDateTime(deal?.closeDate)}</span>
        </div>
      )}
      {providerUrl && (
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Link</span>
          <span className={styles.metaValue}>
            <a
              href={providerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.providerLink}
            >
              {`Open in ${integration?.provider?.display_name || integration?.provider?.name}`}
            </a>
          </span>
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};
    return {
      selectedRelationship: chatId ? selectTelebizSelectedRelationship(global, chatId) : undefined,
    };
  },
)(DealHeaderData));
