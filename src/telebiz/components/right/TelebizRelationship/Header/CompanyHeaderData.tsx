import { memo, useCallback, useMemo } from '@teact';
import { getActions, withGlobal } from '../../../../../global';
import {
  selectTelebizSelectedRelationship,
} from '../../../../global';

import type { Integration, Property, PropertyOption, ProviderRelationship } from '../../../../services/types';
import { type ProviderCompany, ProviderEntityType } from '../../../../services/types';

import { selectCurrentMessageList } from '../../../../../global/selectors';
import buildClassName from '../../../../../util/buildClassName';
import { getLifecycleStageColor, getProviderEntityUrl } from '../../../../util/general';

import { useProviderProperty } from '../../../../hooks/useProviderProperty';

import Icon from '../../../../../components/common/icons/Icon';
import DropdownMenu from '../../../../../components/ui/DropdownMenu';
import MenuItem from '../../../../../components/ui/MenuItem';

import styles from './Header.module.scss';

interface OwnProps {
  company?: ProviderCompany;
  properties: Property[];
  integration?: Integration;
}

interface StateProps {
  selectedRelationship?: ProviderRelationship;
}

const CompanyHeaderData = ({
  company,
  selectedRelationship,
  properties,
  integration,
}: OwnProps & StateProps) => {
  const integrationId = selectedRelationship?.integration_id;
  const { updateTelebizEntity } = getActions();
  const { getPropertyLabel, getPropertyOptions, getPropertyValueFromOptions } =
    useProviderProperty(properties);

  const providerUrl = useMemo(() => {
    if (!integration?.provider?.name || !company?.id) return undefined;
    return getProviderEntityUrl(
      integration.provider.name,
      ProviderEntityType.Company,
      company.id,
      integration.metadata?.user_info?.hub_id,
    );
  }, [integration, company?.id]);

  const industry = getPropertyValueFromOptions(
    company?.industry, 'industry',
  );
  const type = getPropertyValueFromOptions(
    company?.type, 'type',
  );
  const stage = getPropertyValueFromOptions(
    company?.lifecyclestage, 'lifecyclestage',
  );

  const selectOptions = useMemo(() => getPropertyOptions('lifecyclestage'), [getPropertyOptions]) as PropertyOption[];

  const currentStageIndex = selectOptions?.findIndex((option) => option.value === company?.lifecyclestage);

  const stageColor = useMemo(() => {
    return getLifecycleStageColor(currentStageIndex || 0, selectOptions?.length || 0);
  }, [currentStageIndex, selectOptions.length]);

  const changeStage = useCallback((stageId: string) => {
    if (!integrationId || !company || !selectedRelationship) return;
    updateTelebizEntity({
      integrationId,
      entityType: selectedRelationship.entity_type,
      entityId: company.id,
      data: { lifecyclestage: stageId },
    });
  }, [integrationId, company, selectedRelationship, updateTelebizEntity]);

  const SelectMenuButton = useMemo(() => {
    return ({ onTrigger, isOpen }: { onTrigger: () => void; isOpen?: boolean }) => (
      <div
        className={buildClassName(styles.stageMenuButton, isOpen && styles.stageMenuButtonOpen)}
        onClick={onTrigger}
        aria-label="Stage"
      >
        <span className={buildClassName(styles.stageMenuButtonLabel, styles[stageColor])}>
          {stage || 'Select'}
        </span>
        <Icon name="down" className={styles.stageMenuButtonIcon} />
      </div>
    );
  }, [stage, stageColor]);

  return (
    <div className={styles.metaRow}>
      {selectOptions.length > 0 && (
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>{getPropertyLabel('lifecyclestage')}</span>
          <span className={styles.metaValue}>
            <DropdownMenu
              className={styles.stageMenu}
              trigger={SelectMenuButton}
              positionX="right"
            >
              {
                selectOptions.map((option) => (
                  <MenuItem
                    key={option.id}
                    onClick={() => changeStage(option.value)}
                    disabled={option.value === company?.lifecyclestage}
                  >
                    {option.label}
                  </MenuItem>
                ))
              }
            </DropdownMenu>
          </span>
        </div>
      )}
      {type && (
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>{getPropertyLabel('type')}</span>
          <span className={styles.metaValue}>{type || '-'}</span>
        </div>
      )}
      {industry && (
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>{getPropertyLabel('industry')}</span>
          <span className={styles.metaValue}>{industry || '-'}</span>
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
)(CompanyHeaderData));
