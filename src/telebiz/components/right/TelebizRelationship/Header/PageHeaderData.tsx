import { memo, useCallback, useMemo } from '../../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../../global';

import type {
  PropertiesByEntityType,
  Property,
  PropertyOption,
  ProviderPage,
  ProviderRelationship,
} from '../../../../services/types';
import { ProviderEntityType } from '../../../../services/types';

import { selectCurrentMessageList } from '../../../../../global/selectors';
import {
  selectTelebizSelectedRelationship,
} from '../../../../global/selectors';
import buildClassName from '../../../../../util/buildClassName';
import { formatDateTime } from '../../../../util/dates';
import {
  convertFormFieldsToNotionProperties,
  convertNotionPropertiesToFormFields,
  decodeEntityId,
  getFirstSelectProperty,
  getNotionDateValue,
  getNotionPageProperty,
  getNotionPeopleNames,
  getNotionSelectValue,
} from '../../../../util/notion';

import Icon from '../../../../../components/common/icons/Icon';
import DropdownMenu from '../../../../../components/ui/DropdownMenu';
import MenuItem from '../../../../../components/ui/MenuItem';

import styles from './Header.module.scss';

interface OwnProps {
  page: ProviderPage;
  properties: PropertiesByEntityType[];
}

type StateProps = {
  selectedRelationship?: ProviderRelationship;
};

const PageHeaderData = ({
  page,
  selectedRelationship,
  properties,
}: OwnProps & StateProps) => {
  const { updateTelebizEntity } = getActions();

  const { entityProperties, databaseLabel }: { entityProperties: Property[]; databaseLabel?: string } = useMemo(() => {
    const [, databaseId] = decodeEntityId(page.id);
    if (properties) {
      const entityType = properties.find((e) => e.id === databaseId);
      if (entityType) {
        return { entityProperties: entityType.properties, databaseLabel: entityType.label };
      }
    }
    return { entityProperties: [], databaseLabel: undefined };
  }, [page, properties]);

  const selectField = useMemo(() => {
    const prop = getFirstSelectProperty(entityProperties);
    if (!prop) return undefined;
    const [field] = convertNotionPropertiesToFormFields([prop], page.properties);
    return field;
  }, [entityProperties, page.properties]);

  const selectFieldColor = useMemo(() => {
    return page.properties[selectField?.name as string]?.color || 'default';
  }, [page.properties, selectField?.name]);

  const selectFieldLabel = useMemo(() => {
    return selectField?.options?.find((option: PropertyOption) => option.value === selectField?.value)?.label;
  }, [selectField]);

  const changePropertyValue = useCallback((value: string) => {
    if (!selectedRelationship || !page.id || !selectField) return;

    const payload = convertFormFieldsToNotionProperties({
      [selectField.name]: { ...selectField, value },
    }, entityProperties);
    updateTelebizEntity({
      integrationId: selectedRelationship.integration_id,
      entityType: ProviderEntityType.Page,
      entityId: page.id,
      data: {
        properties: payload,
      },
    });
  }, [page, selectedRelationship, updateTelebizEntity, selectField, entityProperties]);

  const SelectMenuButton = useMemo(() => {
    return ({ onTrigger, isOpen }: { onTrigger: () => void; isOpen?: boolean }) => (
      <div
        className={buildClassName(styles.stageMenuButton, isOpen && styles.stageMenuButtonOpen)}
        onClick={onTrigger}
        aria-label={selectFieldLabel}
      >
        <div
          className={buildClassName(styles.stageMenuButtonLabel,
            styles[selectFieldColor === 'default' ? 'white' : selectFieldColor])}
        >
          {selectFieldLabel || 'No Value'}
        </div>
        <Icon name="down" className={styles.stageMenuButtonIcon} />
      </div>
    );
  }, [selectFieldColor, selectFieldLabel]);

  const priority = useMemo(() => {
    const priorityProp = getNotionPageProperty(page, 'Priority');
    return getNotionSelectValue(priorityProp);
  }, [page]);

  const date = useMemo(() => {
    return getNotionDateValue(page);
  }, [page]);

  const assignee = useMemo(() => {
    const assigneeProp = getNotionPageProperty(page, 'Assignee');
    return getNotionPeopleNames(assigneeProp);
  }, [page]);

  return (
    <div className={styles.metaRow}>
      {selectField && (
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>{selectField?.label}</span>
          <span className={styles.metaValue}>
            {selectField?.options ? (
              <DropdownMenu
                className={styles.stageMenu}
                trigger={SelectMenuButton}
                positionX="right"
              >
                {selectField?.options?.map((option: PropertyOption) => (
                  <MenuItem
                    key={option.value}
                    onClick={() => changePropertyValue(option.value)}
                    disabled={option.value === selectField?.value}
                  >
                    {option.label}
                  </MenuItem>
                ))}
              </DropdownMenu>
            ) : (
              <div
                className={styles.stageMenuButtonLabel}
                style={{ backgroundColor: 'var(--color-background-own)' } as any}
              >
                {selectField?.value}
              </div>
            )}
          </span>
        </div>
      )}

      {databaseLabel && (
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Database</span>
          <span className={styles.metaValue}>{databaseLabel}</span>
        </div>
      )}

      {priority && (
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Priority</span>
          <span className={styles.metaValue}>{priority}</span>
        </div>
      )}

      {assignee && (
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Assignee</span>
          <span className={styles.metaValue}>{assignee}</span>
        </div>
      )}

      {date && (
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>{date.label}</span>
          <span className={styles.metaValue}>
            {formatDateTime(date.start)}
            {date.end ? ` - ${formatDateTime(date.end)}` : ''}
          </span>
        </div>
      )}

      {page.url && (
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Link</span>
          <span className={styles.metaValue}>
            <a
              href={page.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-primary)' } as any}
            >
              Open in Notion
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
    const selectedRelationship = chatId ? selectTelebizSelectedRelationship(global, chatId) : undefined;

    return {
      selectedRelationship,
    };
  },
)(PageHeaderData));
