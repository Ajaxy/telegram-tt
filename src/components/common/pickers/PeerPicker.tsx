import React, {
  memo, useCallback, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import type { CustomPeerType, UniqueCustomPeer } from '../../../types';

import { DEBUG } from '../../../config';
import { requestMeasure } from '../../../lib/fasterdom/fasterdom';
import { getGroupStatus, getUserStatus, isUserOnline } from '../../../global/helpers';
import { getPeerTypeKey, isApiPeerChat } from '../../../global/helpers/peers';
import { selectPeer, selectUserStatus } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { buildCollectionByKey } from '../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';

import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Checkbox from '../../ui/Checkbox';
import InfiniteScroll from '../../ui/InfiniteScroll';
import InputText from '../../ui/InputText';
import Loading from '../../ui/Loading';
import Radio from '../../ui/Radio';
import Avatar from '../Avatar';
import FullNameTitle from '../FullNameTitle';
import Icon from '../icons/Icon';
import PeerChip from '../PeerChip';
import PickerItem from './PickerItem';

import styles from './PickerStyles.module.scss';

type SingleModeProps<CategoryType extends string> = {
  allowMultiple?: false;
  itemInputType?: 'radio';
  selectedId?: string;
  selectedIds?: never; // Help TS to throw an error if this is passed
  selectedCategory?: CategoryType;
  selectedCategories?: never;
  onSelectedCategoryChange?: (category: CategoryType) => void;
  onSelectedIdChange?: (id: string) => void;
};

type MultipleModeProps<CategoryType extends string> = {
  allowMultiple: true;
  itemInputType: 'checkbox';
  selectedId?: never;
  selectedIds: string[];
  lockedSelectedIds?: string[];
  lockedUnselectedIds?: string[];
  selectedCategory?: never;
  selectedCategories?: CategoryType[];
  onSelectedCategoriesChange?: (categories: CategoryType[]) => void;
  onSelectedIdsChange?: (Ids: string[]) => void;
};

type OwnProps<CategoryType extends string> = {
  className?: string;
  categories?: UniqueCustomPeer<CategoryType>[];
  itemIds: string[];
  lockedUnselectedSubtitle?: string;
  filterValue?: string;
  filterPlaceholder?: string;
  categoryPlaceholderKey?: string;
  notFoundText?: string;
  searchInputId?: string;
  itemClassName?: string;
  isLoading?: boolean;
  noScrollRestore?: boolean;
  isSearchable?: boolean;
  forceShowSelf?: boolean;
  isViewOnly?: boolean;
  withStatus?: boolean;
  withPeerTypes?: boolean;
  withPeerUsernames?: boolean;
  withDefaultPadding?: boolean;
  onFilterChange?: (value: string) => void;
  onDisabledClick?: (id: string, isSelected: boolean) => void;
  onLoadMore?: () => void;
} & (SingleModeProps<CategoryType> | MultipleModeProps<CategoryType>);

// Focus slows down animation, also it breaks transition layout in Chrome
const FOCUS_DELAY_MS = 500;

const MAX_FULL_ITEMS = 10;
const ALWAYS_FULL_ITEMS_COUNT = 5;

const ITEM_CLASS_NAME = 'PeerPickerItem';

const PeerPicker = <CategoryType extends string = CustomPeerType>({
  className,
  categories,
  itemIds,
  categoryPlaceholderKey,
  filterValue,
  filterPlaceholder,
  notFoundText,
  searchInputId,
  itemClassName,
  isLoading,
  noScrollRestore,
  isSearchable,
  lockedUnselectedSubtitle,
  forceShowSelf,
  isViewOnly,
  itemInputType,
  withStatus,
  withPeerTypes,
  withPeerUsernames,
  withDefaultPadding,
  onFilterChange,
  onDisabledClick,
  onLoadMore,
  ...optionalProps
}: OwnProps<CategoryType>) => {
  const lang = useOldLang();

  const allowMultiple = optionalProps.allowMultiple;
  const lockedSelectedIds = allowMultiple ? optionalProps.lockedSelectedIds : undefined;
  const lockedUnselectedIds = allowMultiple ? optionalProps.lockedUnselectedIds : undefined;
  const selectedCategories = useMemo(() => {
    if (allowMultiple) {
      return optionalProps.selectedCategories;
    }

    return optionalProps.selectedCategory ? [optionalProps.selectedCategory] : MEMO_EMPTY_ARRAY;
  }, [allowMultiple, optionalProps.selectedCategory, optionalProps.selectedCategories]);

  const selectedIds = useMemo(() => {
    if (allowMultiple) {
      return optionalProps.selectedIds;
    }

    return optionalProps.selectedId ? [optionalProps.selectedId] : MEMO_EMPTY_ARRAY;
  }, [allowMultiple, optionalProps.selectedId, optionalProps.selectedIds]);

  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);
  const shouldMinimize = selectedIds.length > MAX_FULL_ITEMS;

  useEffect(() => {
    if (!isSearchable) return undefined;
    const timeoutId = window.setTimeout(() => {
      requestMeasure(() => {
        inputRef.current?.focus();
      });
    }, FOCUS_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
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

    if (allowMultiple && categoriesByType[id]) {
      const categoryType = categoriesByType[id].type;
      const newSelectedCategories = selectedCategories?.slice() || [];
      if (newSelectedCategories.includes(categoryType)) {
        newSelectedCategories.splice(newSelectedCategories.indexOf(categoryType), 1);
      } else {
        newSelectedCategories.push(categoryType);
      }
      optionalProps.onSelectedCategoriesChange?.(newSelectedCategories);

      return;
    }

    if (allowMultiple) {
      const newSelectedIds = selectedIds.slice();
      if (newSelectedIds.includes(id)) {
        newSelectedIds.splice(newSelectedIds.indexOf(id), 1);
      } else {
        newSelectedIds.push(id);
      }
      optionalProps.onSelectedIdsChange?.(newSelectedIds);

      return;
    }

    if (categoriesByType[id]) {
      optionalProps.onSelectedCategoryChange?.(categoriesByType[id].type);
      return;
    }

    optionalProps.onSelectedIdChange?.(id);
  });

  const handleFilterChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.currentTarget;
    onFilterChange?.(value);
  });

  const [viewportIds, getMore] = useInfiniteScroll(
    onLoadMore, sortedItemIds, Boolean(filterValue),
  );

  const renderItem = useCallback((id: string, isCategory?: boolean) => {
    const global = getGlobal();
    const category = isCategory ? categoriesByType[id] : undefined;
    const peer = !isCategory ? selectPeer(global, id) : undefined;

    const peerOrCategory = peer || category;
    if (!peerOrCategory) {
      if (DEBUG) return <div key={id}>No peer or category with ID {id}</div>;
      return undefined;
    }

    const isSelf = peer && !isApiPeerChat(peer) ? (peer.isSelf && !forceShowSelf) : undefined;

    const isAlwaysUnselected = lockedUnselectedIdsSet.has(id);
    const isAlwaysSelected = lockedSelectedIdsSet.has(id);
    const isLocked = isAlwaysUnselected || isAlwaysSelected;
    const isChecked = category ? selectedCategories?.includes(category.type) : selectedIds.includes(id);

    function getInputElement() {
      if (isLocked) return <Icon name="lock-badge" />;
      if (itemInputType === 'radio') {
        return <Radio checked={isChecked} disabled={isLocked} onlyInput />;
      }
      if (itemInputType === 'checkbox') {
        return <Checkbox checked={isChecked} disabled={isLocked} onlyInput />;
      }
      return undefined;
    }

    function getSubtitle() {
      if (isAlwaysUnselected) return [lockedUnselectedSubtitle];
      if (!peer) return undefined;

      if (withPeerUsernames) {
        const username = peer.usernames?.[0]?.username;
        if (username) {
          return [`@${username}`];
        }
      }

      if (withStatus) {
        if (isApiPeerChat(peer)) {
          return [getGroupStatus(lang, peer)];
        }

        const userStatus = selectUserStatus(global, peer.id);
        return [
          getUserStatus(lang, peer, userStatus),
          buildClassName(isUserOnline(peer, userStatus, true) && styles.onlineStatus),
        ];
      }

      if (withPeerTypes) {
        const langKey = getPeerTypeKey(peer);
        return langKey && [lang(langKey)];
      }

      return undefined;
    }

    const [subtitle, subtitleClassName] = getSubtitle() || [];

    return (
      <PickerItem
        key={id}
        className={buildClassName(ITEM_CLASS_NAME, itemClassName)}
        title={<FullNameTitle peer={peerOrCategory} />}
        avatarElement={(
          <Avatar
            peer={peer || category}
            isSavedMessages={isSelf}
            size="medium"
          />
        )}
        subtitle={subtitle}
        subtitleClassName={subtitleClassName}
        disabled={isLocked}
        inactive={isViewOnly}
        ripple
        inputElement={getInputElement()}
        inputPosition="end"
        // eslint-disable-next-line react/jsx-no-bind
        onClick={() => handleItemClick(id)}
        // eslint-disable-next-line react/jsx-no-bind
        onDisabledClick={onDisabledClick && (() => onDisabledClick(id, isAlwaysSelected))}
      />
    );
  }, [
    categoriesByType, forceShowSelf, isViewOnly, itemClassName, itemInputType, lang, lockedSelectedIdsSet,
    lockedUnselectedIdsSet, lockedUnselectedSubtitle, onDisabledClick, selectedCategories, selectedIds,
    withPeerTypes, withStatus, withPeerUsernames,
  ]);

  const beforeChildren = useMemo(() => {
    if (!categories?.length) return undefined;
    return (
      <div key="categories">
        {categoryPlaceholderKey && <div className={styles.pickerCategoryTitle}>{lang(categoryPlaceholderKey)}</div>}
        {categories?.map((category) => renderItem(category.type, true))}
        <div className={styles.pickerCategoryTitle}>{lang('FilterChats')}</div>
      </div>
    );
  }, [categories, categoryPlaceholderKey, lang, renderItem]);

  return (
    <div className={buildClassName(styles.container, className)}>
      {isSearchable && (
        <div className={buildClassName(styles.header, 'custom-scroll')} dir={lang.isRtl ? 'rtl' : undefined}>
          {selectedCategories?.map((category) => (
            <PeerChip
              className={styles.peerChip}
              customPeer={categoriesByType[category]}
              onClick={handleItemClick}
              clickArg={category}
              canClose
            />
          ))}
          {lockedSelectedIds?.map((id, i) => (
            <PeerChip
              className={styles.peerChip}
              peerId={id}
              isMinimized={shouldMinimize && i < selectedIds.length - ALWAYS_FULL_ITEMS_COUNT}
              forceShowSelf={forceShowSelf}
              onClick={handleItemClick}
              clickArg={id}
            />
          ))}
          {unlockedSelectedIds.map((id, i) => (
            <PeerChip
              className={styles.peerChip}
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
          className={buildClassName(styles.pickerList, withDefaultPadding && styles.padded, 'custom-scroll')}
          items={viewportIds}
          itemSelector={`.${ITEM_CLASS_NAME}`}
          beforeChildren={beforeChildren}
          onLoadMore={getMore}
          noScrollRestore={noScrollRestore}
        >
          {viewportIds.map((id) => renderItem(id))}
        </InfiniteScroll>
      ) : !isLoading && viewportIds && !viewportIds.length ? (
        <p className={styles.noResults}>{notFoundText || 'Sorry, nothing found.'}</p>
      ) : (
        <Loading />
      )}
    </div>
  );
};

export default memo(PeerPicker);
