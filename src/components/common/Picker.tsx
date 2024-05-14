import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';

import type { ApiCountry } from '../../api/types';
import type { CustomPeer, CustomPeerType } from '../../types';

import { requestMeasure } from '../../lib/fasterdom/fasterdom';
import { isUserId } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import { buildCollectionByKey } from '../../util/iteratees';

import useInfiniteScroll from '../../hooks/useInfiniteScroll';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Checkbox from '../ui/Checkbox';
import InfiniteScroll from '../ui/InfiniteScroll';
import InputText from '../ui/InputText';
import ListItem from '../ui/ListItem';
import Loading from '../ui/Loading';
import GroupChatInfo from './GroupChatInfo';
import PickerSelectedItem from './PickerSelectedItem';
import PrivateChatInfo from './PrivateChatInfo';

import './Picker.scss';

type OwnProps = {
  className?: string;
  categories?: CustomPeer[];
  itemIds: string[];
  selectedCategories?: CustomPeerType[];
  selectedIds: string[];
  lockedSelectedIds?: string[];
  lockedUnselectedIds?: string[];
  lockedUnselectedSubtitle?: string;
  filterValue?: string;
  filterPlaceholder?: string;
  notFoundText?: string;
  searchInputId?: string;
  isLoading?: boolean;
  noScrollRestore?: boolean;
  isSearchable?: boolean;
  isRoundCheckbox?: boolean;
  forceShowSelf?: boolean;
  isViewOnly?: boolean;
  onSelectedCategoriesChange?: (categories: CustomPeerType[]) => void;
  onSelectedIdsChange?: (ids: string[]) => void;
  onFilterChange?: (value: string) => void;
  onDisabledClick?: (id: string, isSelected: boolean) => void;
  onLoadMore?: () => void;
  isCountryList?: boolean;
  countryList?: ApiCountry[];
};

// Focus slows down animation, also it breaks transition layout in Chrome
const FOCUS_DELAY_MS = 500;

const MAX_FULL_ITEMS = 10;
const ALWAYS_FULL_ITEMS_COUNT = 5;

const Picker: FC<OwnProps> = ({
  className,
  categories,
  itemIds,
  selectedCategories,
  selectedIds,
  filterValue,
  filterPlaceholder,
  notFoundText,
  searchInputId,
  isLoading,
  noScrollRestore,
  isSearchable,
  isRoundCheckbox,
  lockedSelectedIds,
  lockedUnselectedIds,
  lockedUnselectedSubtitle,
  forceShowSelf,
  isViewOnly,
  onSelectedCategoriesChange,
  onSelectedIdsChange,
  onFilterChange,
  onDisabledClick,
  onLoadMore,
  isCountryList,
  countryList,
}) => {
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);
  const shouldMinimize = selectedIds.length > MAX_FULL_ITEMS;

  useEffect(() => {
    if (!isSearchable) return;
    setTimeout(() => {
      requestMeasure(() => {
        inputRef.current!.focus();
      });
    }, FOCUS_DELAY_MS);
  }, [isSearchable]);

  const lockedSelectedIdsSet = useMemo(() => new Set(lockedSelectedIds), [lockedSelectedIds]);
  const lockedUnselectedIdsSet = useMemo(() => new Set(lockedUnselectedIds), [lockedUnselectedIds]);

  const unlockedSelectedIds = useMemo(() => {
    return selectedIds.filter((id) => !lockedSelectedIdsSet.has(id));
  }, [lockedSelectedIdsSet, selectedIds]);

  const categoriesByType = useMemo(() => {
    if (!categories) return {};
    return buildCollectionByKey(categories, 'type');
  }, [categories]);

  const sortedItemIds = useMemo(() => {
    if (filterValue) {
      return itemIds;
    }

    const lockedSelectedBucket: string[] = [];
    const unlockedBucket: string[] = [];
    const lockedUnselectableBucket: string[] = [];

    itemIds.forEach((id) => {
      if (lockedSelectedIdsSet.has(id)) {
        lockedSelectedBucket.push(id);
      } else if (lockedUnselectedIdsSet.has(id)) {
        lockedUnselectableBucket.push(id);
      } else {
        unlockedBucket.push(id);
      }
    });

    return lockedSelectedBucket.concat(unlockedBucket, lockedUnselectableBucket);
  }, [filterValue, itemIds, lockedSelectedIdsSet, lockedUnselectedIdsSet]);

  const handleItemClick = useLastCallback((id: string) => {
    if (lockedSelectedIdsSet.has(id)) {
      onDisabledClick?.(id, true);
      return;
    }

    if (lockedUnselectedIdsSet.has(id)) {
      onDisabledClick?.(id, false);
      return;
    }

    if (categoriesByType[id]) {
      const categoryType = categoriesByType[id].type;
      const newSelectedCategories = selectedCategories?.slice() || [];
      if (newSelectedCategories.includes(categoryType)) {
        newSelectedCategories.splice(newSelectedCategories.indexOf(categoryType), 1);
      } else {
        newSelectedCategories.push(categoryType);
      }
      onSelectedCategoriesChange?.(newSelectedCategories);
    } else {
      const newSelectedIds = selectedIds.slice();
      if (newSelectedIds.includes(id)) {
        newSelectedIds.splice(newSelectedIds.indexOf(id), 1);
      } else {
        newSelectedIds.push(id);
      }
      onSelectedIdsChange?.(newSelectedIds);
    }
    onFilterChange?.('');
  });

  const handleFilterChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.currentTarget;
    onFilterChange?.(value);
  });

  const [viewportIds, getMore] = useInfiniteScroll(onLoadMore, sortedItemIds, Boolean(filterValue));

  const lang = useLang();

  const countriesByIso = useMemo(() => {
    if (!countryList) return undefined;
    return buildCollectionByKey(countryList, 'iso2');
  }, [countryList]);

  const renderCategory = useLastCallback((category: CustomPeer) => {
    return (
      <PrivateChatInfo
        customPeer={category}
      />
    );
  });

  const renderChatInfo = useLastCallback((id: string) => {
    const isUnselectable = lockedUnselectedIdsSet.has(id);
    if (isCountryList && countriesByIso) {
      const country = countriesByIso[id];
      return <div>{country.defaultName}</div>;
    } else if (isUserId(id)) {
      return (
        <PrivateChatInfo
          forceShowSelf={forceShowSelf}
          userId={id}
          status={isUnselectable ? lockedUnselectedSubtitle : undefined}
        />
      );
    } else {
      return <GroupChatInfo chatId={id} status={isUnselectable ? lockedUnselectedSubtitle : undefined} />;
    }
  });

  const renderItem = useCallback((id: string, isCategory?: boolean) => {
    const category = isCategory ? categoriesByType[id] : undefined;
    const shouldRenderLockIcon = lockedUnselectedIdsSet.has(id);
    const isLocked = lockedSelectedIdsSet.has(id) || shouldRenderLockIcon;
    const isChecked = category ? selectedCategories?.includes(category.type) : selectedIds.includes(id);
    const renderCheckbox = () => {
      return (isViewOnly || shouldRenderLockIcon) ? undefined : (
        <Checkbox
          label=""
          disabled={isLocked}
          checked={isChecked}
          round={isRoundCheckbox}
        />
      );
    };
    return (
      <ListItem
        key={id}
        className={buildClassName('chat-item-clickable picker-list-item', isRoundCheckbox && 'chat-item')}
        disabled={isLocked}
        inactive={isViewOnly}
        allowDisabledClick={Boolean(onDisabledClick)}
        secondaryIcon={shouldRenderLockIcon ? 'lock-badge' : undefined}
        // eslint-disable-next-line react/jsx-no-bind
        onClick={() => handleItemClick(id)}
        ripple
      >
        {!isRoundCheckbox ? renderCheckbox() : undefined}
        {category ? renderCategory(category) : renderChatInfo(id)}
        {isRoundCheckbox ? renderCheckbox() : undefined}
      </ListItem>
    );
  }, [
    categoriesByType, isRoundCheckbox, isViewOnly, lockedSelectedIdsSet, lockedUnselectedIdsSet,
    onDisabledClick, renderChatInfo, selectedCategories, selectedIds,
  ]);

  const beforeChildren = useMemo(() => {
    return (
      <div key="categories">
        {Boolean(categories?.length) && (
          <div className="picker-category-title">{lang('PrivacyUserTypes')}</div>
        )}
        {categories?.map((category) => renderItem(category.type, true))}
        <div className="picker-category-title">{lang('FilterChats')}</div>
      </div>
    );
  }, [categories, lang, renderItem]);

  return (
    <div className={buildClassName('Picker', className)}>
      {isSearchable && (
        <div className="picker-header custom-scroll" dir={lang.isRtl ? 'rtl' : undefined}>
          {selectedCategories?.map((category) => (
            <PickerSelectedItem
              customPeer={categoriesByType[category]}
              onClick={handleItemClick}
              clickArg={category}
              canClose
            />
          ))}
          {lockedSelectedIds?.map((id, i) => (
            <PickerSelectedItem
              peerId={id}
              isMinimized={shouldMinimize && i < selectedIds.length - ALWAYS_FULL_ITEMS_COUNT}
              forceShowSelf={forceShowSelf}
              onClick={handleItemClick}
              clickArg={id}
            />
          ))}
          {unlockedSelectedIds.map((id, i) => (
            <PickerSelectedItem
              peerId={id}
              isMinimized={
                shouldMinimize && i + (lockedSelectedIds?.length || 0) < selectedIds.length - ALWAYS_FULL_ITEMS_COUNT
              }
              canClose
              onClick={handleItemClick}
              clickArg={id}
            />
          ))}
          <InputText
            id={searchInputId}
            ref={inputRef}
            value={filterValue}
            onChange={handleFilterChange}
            placeholder={filterPlaceholder || lang('SelectChat')}
          />
        </div>
      )}

      {viewportIds?.length ? (
        <InfiniteScroll
          className={buildClassName('picker-list', 'custom-scroll', isRoundCheckbox && 'withRoundedCheckbox')}
          items={viewportIds}
          beforeChildren={beforeChildren}
          onLoadMore={getMore}
          noScrollRestore={noScrollRestore}
        >
          {viewportIds.map((id) => renderItem(id))}
        </InfiniteScroll>
      ) : !isLoading && viewportIds && !viewportIds.length ? (
        <p className="no-results">{notFoundText || 'Sorry, nothing found.'}</p>
      ) : (
        <Loading />
      )}
    </div>
  );
};

export default memo(Picker);
