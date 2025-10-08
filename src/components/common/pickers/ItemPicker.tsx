import type { TeactNode } from '../../../lib/teact/teact';
import type React from '../../../lib/teact/teact';
import {
  memo, useCallback, useEffect,
  useMemo,
  useRef,
} from '../../../lib/teact/teact';

import { requestMeasure } from '../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../util/buildClassName';
import focusNoScroll from '../../../util/focusNoScroll';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';

import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Checkbox from '../../ui/Checkbox';
import InfiniteScroll from '../../ui/InfiniteScroll';
import InputText from '../../ui/InputText';
import Loading from '../../ui/Loading';
import Radio from '../../ui/Radio';
import Icon from '../icons/Icon';
import PickerItem from './PickerItem';

import styles from './PickerStyles.module.scss';

export type ItemPickerOption = {
  label: TeactNode;
  subLabel?: string;
  disabled?: boolean;
  isLoading?: boolean;
  value: string;
};

type SingleModeProps = {
  allowMultiple?: false;
  itemInputType?: 'radio';
  selectedValue?: string;
  selectedValues?: never; // Help TS to throw an error if this is passed
  onSelectedValueChange?: (value: string) => void;
};

type MultipleModeProps = {
  allowMultiple: true;
  itemInputType: 'checkbox';
  selectedValue?: never;
  selectedValues: string[];
  lockedSelectedValues?: string[];
  lockedUnselectedValues?: string[];
  onSelectedValuesChange?: (values: string[]) => void;
};

type OwnProps = {
  className?: string;
  isSearchable?: boolean;
  searchInputId?: string;
  items: ItemPickerOption[];
  itemClassName?: string;
  filterValue?: string;
  filterPlaceholder?: string;
  notFoundText?: string;
  isLoading?: boolean;
  noScrollRestore?: boolean;
  isViewOnly?: boolean;
  withDefaultPadding?: boolean;
  forceRenderAllItems?: boolean;
  onFilterChange?: (value: string) => void;
  onDisabledClick?: (value: string, isSelected: boolean) => void;
  onLoadMore?: () => void;
} & (SingleModeProps | MultipleModeProps);

const ITEM_CLASS_NAME = 'ItemPickerItem';

const ItemPicker = ({
  className,
  isSearchable,
  searchInputId,
  items,
  filterValue,
  notFoundText,
  isLoading,
  noScrollRestore,
  filterPlaceholder,
  isViewOnly,
  itemInputType,
  itemClassName,
  withDefaultPadding,
  forceRenderAllItems,
  onFilterChange,
  onDisabledClick,
  onLoadMore,
  ...optionalProps
}: OwnProps) => {
  const lang = useOldLang();
  const inputRef = useRef<HTMLInputElement>();

  const allowMultiple = optionalProps.allowMultiple;
  const lockedSelectedValues = allowMultiple ? optionalProps.lockedSelectedValues : undefined;
  const lockedUnselectedValues = allowMultiple ? optionalProps.lockedUnselectedValues : undefined;

  useEffect(() => {
    if (!isSearchable) return undefined;
    requestMeasure(() => {
      focusNoScroll(inputRef.current);
    });
  }, [isSearchable]);

  const selectedValues = useMemo(() => {
    if (allowMultiple) {
      return optionalProps.selectedValues;
    }

    return optionalProps.selectedValue ? [optionalProps.selectedValue] : MEMO_EMPTY_ARRAY;
  }, [allowMultiple, optionalProps.selectedValue, optionalProps.selectedValues]);

  const lockedSelectedValuesSet = useMemo(() => new Set(lockedSelectedValues), [lockedSelectedValues]);
  const lockedUnselectedValuesSet = useMemo(() => new Set(lockedUnselectedValues), [lockedUnselectedValues]);

  const sortedItemValuesList = useMemo(() => {
    if (filterValue) {
      return items.map((item) => item.value);
    }

    const lockedSelectedBucket: ItemPickerOption[] = [];
    const unlockedBucket: ItemPickerOption[] = [];
    const lockedUnselectableBucket: ItemPickerOption[] = [];

    items.forEach((item) => {
      if (lockedSelectedValuesSet.has(item.value)) {
        lockedSelectedBucket.push(item);
      } else if (lockedUnselectedValuesSet.has(item.value)) {
        lockedUnselectableBucket.push(item);
      } else {
        unlockedBucket.push(item);
      }
    });

    return lockedSelectedBucket.concat(unlockedBucket, lockedUnselectableBucket).map((item) => item.value);
  }, [filterValue, items, lockedSelectedValuesSet, lockedUnselectedValuesSet]);

  const handleItemClick = useLastCallback((value: string) => {
    if (allowMultiple) {
      const newSelectedValues = selectedValues.slice();
      const index = newSelectedValues.indexOf(value);
      if (index >= 0) {
        newSelectedValues.splice(index, 1);
      } else {
        newSelectedValues.push(value);
      }

      optionalProps.onSelectedValuesChange?.(newSelectedValues);
      return;
    }

    optionalProps.onSelectedValueChange?.(value);
  });

  const [viewportValuesList, getMore] = useInfiniteScroll(
    onLoadMore, sortedItemValuesList, Boolean(forceRenderAllItems || filterValue),
  );

  const handleFilterChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.currentTarget;
    onFilterChange?.(value);
  });

  const renderItem = useCallback((value: string) => {
    const item = items.find((itemOption) => itemOption.value === value);
    if (!item) return undefined;

    const { label, subLabel, isLoading: isItemLoading } = item;
    const isAlwaysUnselected = lockedUnselectedValuesSet.has(value);
    const isAlwaysSelected = lockedSelectedValuesSet.has(value);
    const isLocked = isAlwaysUnselected || isAlwaysSelected;
    const isChecked = selectedValues.includes(value);

    function getInputElement() {
      if (isLocked) return <Icon name="lock-badge" />;
      if (itemInputType === 'radio') {
        return <Radio checked={isChecked} disabled={isLocked} isLoading={isItemLoading} onlyInput />;
      }
      if (itemInputType === 'checkbox') {
        return <Checkbox checked={isChecked} disabled={isLocked} isLoading={isItemLoading} onlyInput />;
      }
      return undefined;
    }

    return (
      <PickerItem
        key={value}
        className={buildClassName(ITEM_CLASS_NAME, itemClassName)}
        title={label}
        subtitle={subLabel}
        disabled={isLocked}
        inactive={isViewOnly}
        ripple
        inputElement={getInputElement()}

        onClick={() => handleItemClick(value)}

        onDisabledClick={onDisabledClick && (() => onDisabledClick(value, isAlwaysSelected))}
      />
    );
  }, [
    items, lockedUnselectedValuesSet, lockedSelectedValuesSet, selectedValues, isViewOnly, onDisabledClick,
    itemInputType, itemClassName,
  ]);

  return (
    <div className={buildClassName(styles.container, className)}>
      {isSearchable && (
        <div className={buildClassName(styles.header, 'custom-scroll')} dir={lang.isRtl ? 'rtl' : undefined}>
          <InputText
            id={searchInputId}
            ref={inputRef}
            value={filterValue}
            onChange={handleFilterChange}
            placeholder={filterPlaceholder || lang('Search')}
          />
        </div>
      )}

      {viewportValuesList?.length ? (
        <InfiniteScroll
          className={buildClassName(styles.pickerList, withDefaultPadding && styles.padded, 'custom-scroll')}
          items={viewportValuesList}
          itemSelector={`.${ITEM_CLASS_NAME}`}
          onLoadMore={getMore}
          noScrollRestore={noScrollRestore}
        >
          {viewportValuesList.map((value) => renderItem(value))}
        </InfiniteScroll>
      ) : !isLoading && viewportValuesList && !viewportValuesList.length ? (
        <p className={styles.noResults}>{notFoundText || lang('SearchEmptyViewTitle')}</p>
      ) : (
        <Loading />
      )}
    </div>
  );
};

export default memo(ItemPicker);
