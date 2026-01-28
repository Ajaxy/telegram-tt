import { memo, useCallback, useMemo } from '@teact';
import { getActions, withGlobal } from '../../../../../global';
import {
  selectTelebizSelectedRelationship,
} from '../../../../global';

import type { Integration, Property, PropertyOption, ProviderRelationship } from '../../../../services/types';
import { type ProviderContact, ProviderEntityType } from '../../../../services/types';

import { selectCurrentMessageList } from '../../../../../global/selectors';
import buildClassName from '../../../../../util/buildClassName';
import { getLifecycleStageColor, getProviderEntityUrl } from '../../../../util/general';

import { useProviderProperty } from '../../../../hooks/useProviderProperty';

import Icon from '../../../../../components/common/icons/Icon';
import DropdownMenu from '../../../../../components/ui/DropdownMenu';
import MenuItem from '../../../../../components/ui/MenuItem';

import styles from './Header.module.scss';

interface OwnProps {
  contact?: ProviderContact;
  properties: Property[];
  integration?: Integration;
}

interface StateProps {
  selectedRelationship?: ProviderRelationship;
  integrationId?: number;
}

const ContactHeaderData = ({
  contact,
  selectedRelationship,
  properties,
  integrationId,
  integration,
}: OwnProps & StateProps) => {
  const { getPropertyLabel, getPropertyOptions, getPropertyValueFromOptions } =
    useProviderProperty(properties);
  const { updateTelebizEntity } = getActions();

  const providerUrl = useMemo(() => {
    if (!integration?.provider?.name || !contact?.id) return undefined;
    return getProviderEntityUrl(
      integration.provider.name,
      ProviderEntityType.Contact,
      contact.id,
      integration.metadata?.user_info?.hub_id,
    );
  }, [integration, contact?.id]);

  const stage = getPropertyValueFromOptions(
    contact?.lifecyclestage, 'lifecyclestage',
  );

  const selectOptions = useMemo(() => {
    return getPropertyOptions('lifecyclestage');
  }, [getPropertyOptions]) as PropertyOption[];

  const currentStageIndex = useMemo(() => {
    return selectOptions?.findIndex((option) => option.value === contact?.lifecyclestage);
  }, [selectOptions, contact?.lifecyclestage]);

  const stageColor = useMemo(() => {
    return getLifecycleStageColor(currentStageIndex || 0, selectOptions?.length || 0);
  }, [currentStageIndex, selectOptions.length]);

  const changeStage = useCallback((stageId: string) => {
    if (!integrationId || !contact || !selectedRelationship) return;
    updateTelebizEntity({
      integrationId,
      entityType: selectedRelationship.entity_type,
      entityId: contact.id,
      data: { lifecyclestage: stageId },
    });
  }, [integrationId, contact, selectedRelationship, updateTelebizEntity]);

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
          <span className={styles.metaLabel}>Lifecycle Stage</span>
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
                    disabled={option.value === contact?.lifecyclestage}
                  >
                    {option.label}
                  </MenuItem>
                ))
              }
            </DropdownMenu>
          </span>
        </div>
      )}
      <div className={styles.metaItem}>
        <span className={styles.metaLabel}>{getPropertyLabel('email')}</span>
        <span className={styles.metaValue}>{contact?.email || '-'}</span>
      </div>
      <div className={styles.metaItem}>
        <span className={styles.metaLabel}>{getPropertyLabel('phone')}</span>
        <span className={styles.metaValue}>{contact?.phone || '-'}</span>
      </div>
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
      integrationId: chatId ? selectTelebizSelectedRelationship(global, chatId)?.integration_id : undefined,
    };
  },
)(ContactHeaderData));
