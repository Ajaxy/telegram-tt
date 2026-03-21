import { type MouseEvent as ReactMouseEvent } from 'react';
import type { ElementRef } from '../../../lib/teact/teact';
import type React from '../../../lib/teact/teact';
import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiStarGiftAttribute,
  ApiStarGiftAttributeBackdrop,
  ApiStarGiftAttributeCounter,
  ApiStarGiftAttributeIdBackdrop,
  ApiStarGiftAttributeIdPattern,
  ApiStarGiftAttributeModel,
  ApiStarGiftAttributePattern,
  StarGiftAttributeIdModel,
} from '../../../api/types';
import type { ResaleGiftsFilterOptions, ResaleGiftsSortType } from '../../../types';

import { selectTabState,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import RadialPatternBackground from '../../common/profile/RadialPatternBackground';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import SearchInput from '../../ui/SearchInput';
import ResaleGiftMenuAttributeSticker from './ResaleGiftMenuAttributeSticker';

import styles from './GiftResaleFilters.module.scss';

type FilterType = 'resale' | 'craft';

type OwnProps = {
  dialogRef: ElementRef<HTMLDivElement>;
  className?: string;
  filterType?: FilterType;
};
type StateProps = {
  filter: ResaleGiftsFilterOptions;
  attributes?: ApiStarGiftAttribute[];
  counters?: ApiStarGiftAttributeCounter[];
};

const DEFAULT_CRAFT_FILTER: ResaleGiftsFilterOptions = { sortType: 'byPrice' };

const GiftResaleFilters = ({
  attributes,
  counters,
  filter,
  dialogRef,
  className,
  filterType = 'resale',
}: OwnProps & StateProps) => {
  const lang = useLang();
  const {
    updateResaleGiftsFilter,
    updateCraftGiftsFilter,
  } = getActions();

  const [searchModelQuery, setSearchModelQuery] = useState('');
  const [searchBackdropQuery, setSearchBackdropQuery] = useState('');
  const [searchPatternQuery, setSearchPatternQuery] = useState('');
  const filteredAttributes = useMemo(() => {
    const map: {
      model: ApiStarGiftAttributeModel[];
      pattern: ApiStarGiftAttributePattern[];
      backdrop: ApiStarGiftAttributeBackdrop[];
    } = {
      model: [],
      pattern: [],
      backdrop: [],
    };

    for (const counter of counters ?? []) {
      const { attribute } = counter;

      if (!counter.count) {
        continue;
      }

      const found = attributes?.find((attr) => {
        if (attr.type === 'backdrop' && attribute.type === 'backdrop') {
          return attr.backdropId === attribute.backdropId;
        }

        if (attr.type === 'model' && attribute.type === 'model') {
          return attr.sticker.id === attribute.documentId;
        }

        if (attr.type === 'pattern' && attribute.type === 'pattern') {
          return attr.sticker.id === attribute.documentId;
        }

        return false;
      });

      if (found?.type === 'backdrop') {
        map.backdrop.push(found);
      }
      if (found?.type === 'model') {
        map.model.push(found);
      }
      if (found?.type === 'pattern') {
        map.pattern.push(found);
      }
    }

    return map;
  }, [attributes, counters]);

  const filteredAndSearchedAttributes = useMemo(() => {
    const filterBySearch = <T extends { name?: string }>(items: T[], query: string): T[] => {
      if (!query.trim()) return items;

      return items.filter(
        (item): item is T => Boolean(item.name?.toLowerCase().includes(query.toLowerCase())),
      );
    };

    return {
      model: filterBySearch(filteredAttributes.model, searchModelQuery),
      pattern: filterBySearch(filteredAttributes.pattern, searchPatternQuery),
      backdrop: filterBySearch(filteredAttributes.backdrop, searchBackdropQuery),
    };
  }, [filteredAttributes, searchModelQuery, searchBackdropQuery, searchPatternQuery]);

  const countersMap = useMemo(() => {
    const map = {
      model: new Map<string, number>(),
      pattern: new Map<string, number>(),
      backdrop: new Map<number, number>(),
    };

    for (const counter of counters ?? []) {
      const { attribute, count } = counter;
      if (attribute.type === 'model') {
        map.model.set(attribute.documentId, count);
      } else if (attribute.type === 'pattern') {
        map.pattern.set(attribute.documentId, count);
      } else if (attribute.type === 'backdrop') {
        map.backdrop.set(attribute.backdropId, count);
      }
    }

    return map;
  }, [counters]);

  // Sort Menu
  const sortMenuRef = useRef<HTMLDivElement>();
  const {
    isContextMenuOpen: isSortContextMenuOpen,
    contextMenuAnchor: sortContextMenuAnchor,
    handleContextMenu: handleSortContextMenu,
    handleContextMenuClose: handleSortContextMenuClose,
    handleContextMenuHide: handleSortContextMenuHide,
  } = useContextMenuHandlers(dialogRef);
  const getSortMenuElement = useLastCallback(() => sortMenuRef.current!);

  // Model Menu
  const modelMenuRef = useRef<HTMLDivElement>();
  const {
    isContextMenuOpen: isModelContextMenuOpen,
    contextMenuAnchor: modelContextMenuAnchor,
    handleContextMenu: handleModelContextMenu,
    handleContextMenuClose: handleModelContextMenuClose,
    handleContextMenuHide: handleModelContextMenuHide,
  } = useContextMenuHandlers(dialogRef);
  const getModelMenuElement = useLastCallback(
    () => modelMenuRef.current!,
  );

  // Backdrop Menu
  const backdropMenuRef = useRef<HTMLDivElement>();
  const {
    isContextMenuOpen: isBackdropContextMenuOpen,
    contextMenuAnchor: backdropContextMenuAnchor,
    handleContextMenu: handleBackdropContextMenu,
    handleContextMenuClose: handleBackdropContextMenuClose,
    handleContextMenuHide: handleBackdropContextMenuHide,
  } = useContextMenuHandlers(dialogRef);
  const getBackdropMenuElement = useLastCallback(() => backdropMenuRef.current!);

  // Pattern Menu
  const patternMenuRef = useRef<HTMLDivElement>();
  const {
    isContextMenuOpen: isPatternContextMenuOpen,
    contextMenuAnchor: patternContextMenuAnchor,
    handleContextMenu: handlePatternContextMenu,
    handleContextMenuClose: handlePatternContextMenuClose,
    handleContextMenuHide: handlePatternContextMenuHide,
  } = useContextMenuHandlers(dialogRef);
  const getPatternMenuElement = useLastCallback(() => patternMenuRef.current!);

  const SortMenuButton = useMemo(() => {
    const sortType = filter.sortType;
    const iconName = sortType === 'byDate' ? 'sort-by-date'
      : sortType === 'byNumber' ? 'sort-by-number'
        : 'sort-by-price';
    return ({ onTrigger, isOpen: isMenuOpen }: {
      onTrigger: (e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => void;
      isOpen?: boolean;
    }) => (
      <div
        className={styles.item}
        onClick={onTrigger}
      >
        <Icon
          name={iconName}
          className={styles.itemIcon}
        />
        {sortType === 'byDate' && lang('ValueGiftSortByDate')}
        {sortType === 'byNumber' && lang('ValueGiftSortByNumber')}
        {sortType === 'byPrice' && lang('ValueGiftSortByPrice')}
      </div>
    );
  }, [lang, filter]);

  const ModelMenuButton = useMemo(() => {
    const attributesCount = filter?.modelAttributes?.length || 0;
    return ({ onTrigger, isOpen: isMenuOpen }: {
      onTrigger: (e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => void;
      isOpen?: boolean;
    }) => (
      <div
        className={styles.item}
        onClick={onTrigger}
      >
        {attributesCount === 0 && lang('GiftAttributeModel')}
        {attributesCount > 0
          && lang('GiftAttributeModelPlural', { count: attributesCount }, { pluralValue: attributesCount })}
        {renderDropdownArrows(isMenuOpen)}
      </div>
    );
  }, [lang, filter]);
  const BackdropMenuButton = useMemo(() => {
    const attributesCount = filter?.backdropAttributes?.length || 0;
    return ({ onTrigger, isOpen: isMenuOpen }: {
      onTrigger: (e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => void;
      isOpen?: boolean;
    }) => (
      <div
        className={styles.item}
        onClick={onTrigger}
      >
        {attributesCount === 0 && lang('GiftAttributeBackdrop')}
        {attributesCount > 0
          && lang('GiftAttributeBackdropPlural', { count: attributesCount }, { pluralValue: attributesCount })}
        {renderDropdownArrows(isMenuOpen)}
      </div>
    );
  }, [lang, filter]);
  const PatternMenuButton = useMemo(() => {
    const attributesCount = filter?.patternAttributes?.length || 0;
    return ({ onTrigger, isOpen: isMenuOpen }: {
      onTrigger: (e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => void;
      isOpen?: boolean;
    }) => (
      <div
        className={styles.item}
        onClick={onTrigger}
      >
        {attributesCount === 0 && lang('GiftAttributeSymbol')}
        {attributesCount > 0
          && lang('GiftAttributeSymbolPlural', { count: attributesCount }, { pluralValue: attributesCount })}
        {renderDropdownArrows(isMenuOpen)}
      </div>
    );
  }, [lang, filter]);

  const handleFilterUpdate = useLastCallback((newFilter: ResaleGiftsFilterOptions) => {
    if (filterType === 'craft') {
      updateCraftGiftsFilter({ filter: newFilter });
    } else {
      updateResaleGiftsFilter({ filter: newFilter });
    }
  });

  const handleSortMenuItemClick = useLastCallback((type: ResaleGiftsSortType) => {
    handleFilterUpdate({
      ...filter,
      sortType: type,
    });
  });

  const handleSelectedAllModelsClick = useLastCallback(() => {
    handleFilterUpdate({
      ...filter,
      modelAttributes: [],
    });
  });
  const handleSelectedAllPatternsClick = useLastCallback(() => {
    handleFilterUpdate({
      ...filter,
      patternAttributes: [],
    });
  });
  const handleSelectedAllBackdropsClick = useLastCallback(() => {
    handleFilterUpdate({
      ...filter,
      backdropAttributes: [],
    });
  });

  const handleModelMenuItemClick = useLastCallback((attribute: ApiStarGiftAttributeModel) => {
    if (!counters) return;
    const modelAttributes = filter.modelAttributes || [];
    const modelAttribute
      = counters.find((counter): counter is ApiStarGiftAttributeCounter<StarGiftAttributeIdModel> =>
        counter.attribute.type === 'model' && counter.attribute.documentId === attribute.sticker.id,
      )?.attribute;

    if (!modelAttribute) return;

    const isActive = modelAttributes.some((item) => item.documentId === modelAttribute.documentId);
    const updatedAttributes = isActive
      ? modelAttributes.filter((item) => item.documentId !== modelAttribute.documentId)
      : [...modelAttributes, modelAttribute];
    handleFilterUpdate({
      ...filter,
      modelAttributes: updatedAttributes,
    });
  });

  const handlePatternMenuItemClick = useLastCallback((attribute: ApiStarGiftAttributePattern) => {
    if (!counters) return;
    const patternAttributes = filter.patternAttributes || [];
    const patternAttribute = counters.find(
      (counter): counter is ApiStarGiftAttributeCounter<ApiStarGiftAttributeIdPattern> =>
        counter.attribute.type === 'pattern' && counter.attribute.documentId === attribute.sticker.id,
    )?.attribute;

    if (!patternAttribute) return;

    const isActive = patternAttributes.some((item) => item.documentId === patternAttribute.documentId);
    const updatedAttributes = isActive
      ? patternAttributes.filter((item) => item.documentId !== patternAttribute.documentId)
      : [...patternAttributes, patternAttribute];
    handleFilterUpdate({
      ...filter,
      patternAttributes: updatedAttributes,
    });
  });

  const handleBackdropMenuItemClick = useLastCallback((attribute: ApiStarGiftAttributeBackdrop) => {
    if (!counters) return;
    const backdropAttributes = filter.backdropAttributes || [];
    const backdropAttribute = counters.find(
      (counter): counter is ApiStarGiftAttributeCounter<ApiStarGiftAttributeIdBackdrop> =>
        counter.attribute.type === 'backdrop' && counter.attribute.backdropId === attribute.backdropId,
    )?.attribute;

    if (!backdropAttribute) return;

    const isActive = backdropAttributes.some((item) => item.backdropId === backdropAttribute.backdropId);
    const updatedAttributes = isActive
      ? backdropAttributes.filter((item) => item.backdropId !== backdropAttribute.backdropId)
      : [...backdropAttributes, backdropAttribute];
    handleFilterUpdate({
      ...filter,
      backdropAttributes: updatedAttributes,
    });
  });

  function renderDropdownArrows(isOpen?: boolean) {
    return (
      <div className={styles.dropdownArrows}>
        <div className={buildClassName(styles.arrowLine, styles.topLeft, isOpen && styles.open)} />
        <div className={buildClassName(styles.arrowLine, styles.topRight, isOpen && styles.open)} />
        <div className={buildClassName(styles.arrowLine, styles.bottomLeft, isOpen && styles.open)} />
        <div className={buildClassName(styles.arrowLine, styles.bottomRight, isOpen && styles.open)} />
      </div>
    );
  }

  function renderSortMenuItems() {
    return (
      <>
        <MenuItem icon="sort-by-price" onClick={() => { handleSortMenuItemClick('byPrice'); }}>
          <div className={styles.menuItemText}>
            {lang('GiftSortByPrice')}
          </div>
          <Icon
            className={styles.menuItemIcon}
            name={filter?.sortType === 'byPrice' ? 'check' : 'placeholder'}
          />
        </MenuItem>
        <MenuItem icon="sort-by-date" onClick={() => { handleSortMenuItemClick('byDate'); }}>
          <div className={styles.menuItemText}>
            {lang('GiftSortByDate')}
          </div>
          <Icon
            className={styles.menuItemIcon}
            name={filter?.sortType === 'byDate' ? 'check' : 'placeholder'}
          />

        </MenuItem>
        <MenuItem icon="sort-by-number"onClick={() => { handleSortMenuItemClick('byNumber'); }}>
          <div className={styles.menuItemText}>
            {lang('GiftSortByNumber')}
          </div>
          <Icon
            className={styles.menuItemIcon}
            name={filter?.sortType === 'byNumber' ? 'check' : 'placeholder'}
          />
        </MenuItem>
      </>
    );
  }

  function renderSortMenu() {
    return (
      <Menu
        isOpen={isSortContextMenuOpen}
        anchor={sortContextMenuAnchor}
        ref={sortMenuRef}
        className={buildClassName(
          styles.menu,
          styles.left,
          'with-menu-transitions',
        )}
        getMenuElement={getSortMenuElement}
        autoClose
        onClose={handleSortContextMenuClose}
        onCloseAnimationEnd={handleSortContextMenuHide}
        positionX="left"
      >
        {renderSortMenuItems()}
      </Menu>
    );
  }

  const handleSearchModelInputReset = useCallback(() => {
    setSearchModelQuery('');
  }, []);
  const handleSearchBackdropInputReset = useCallback(() => {
    setSearchBackdropQuery('');
  }, []);
  const handleSearchPatternInputReset = useCallback(() => {
    setSearchPatternQuery('');
  }, []);
  const handleSearchInputClick = useLastCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  });

  const modelMenuItemsContainerRef = useRef<HTMLDivElement>();
  const { observe } = useIntersectionObserver({
    rootRef: modelMenuItemsContainerRef,
    isDisabled: !modelContextMenuAnchor,
  });

  function renderModelMenuItems() {
    const models = filteredAndSearchedAttributes.model;
    const selectedAttributes = filter.modelAttributes ?? [];
    const isSelectedAll = selectedAttributes.length === 0;
    return (
      <div className={styles.menuContentContainer} ref={modelMenuItemsContainerRef}>
        <SearchInput
          onClick={handleSearchInputClick}
          className={styles.search}
          value={searchModelQuery}
          onChange={setSearchModelQuery}
          onReset={handleSearchModelInputReset}
          placeholder={lang('Search')}
        />
        <MenuItem icon="select" onClick={handleSelectedAllModelsClick}>
          {lang('ContextMenuItemSelectAll')}
        </MenuItem>
        {models.map((model) => {
          const isSelected = isSelectedAll
            || selectedAttributes.some((attr) => attr.documentId === model.sticker.id);
          return (
            <MenuItem
              key={model.name}
              onClick={() => {
                handleModelMenuItemClick(model);
              }}
            >
              <ResaleGiftMenuAttributeSticker
                className={styles.sticker}
                sticker={model.sticker}
                type="model"
                observeIntersectionForLoading={observe}
                observeIntersectionForPlaying={observe}
              />
              <div className={styles.menuItemStickerText}>
                {model.name}
                <span className={styles.menuItemCount}>
                  {lang.number(countersMap.model.get(model.sticker.id) || 0)}
                </span>
              </div>
              <Icon
                className={styles.menuItemIcon}
                name={isSelected ? 'check' : 'placeholder'}
              />
            </MenuItem>
          );
        })}
      </div>
    );
  }

  function renderModelMenu() {
    return (
      <Menu
        isOpen={isModelContextMenuOpen}
        anchor={modelContextMenuAnchor}
        ref={modelMenuRef}
        className={buildClassName(
          styles.menu,
          styles.left,
          'with-menu-transitions',
        )}
        getMenuElement={getModelMenuElement}
        autoClose
        onClose={handleModelContextMenuClose}
        onCloseAnimationEnd={handleModelContextMenuHide}
      >
        {renderModelMenuItems()}
      </Menu>
    );
  }

  function renderBackdropMenuItems() {
    const backdrops = filteredAndSearchedAttributes.backdrop;
    const selectedAttributes = filter.backdropAttributes ?? [];
    const isSelectedAll = selectedAttributes.length === 0;

    return (
      <div className={styles.menuContentContainer}>
        <SearchInput
          onClick={handleSearchInputClick}
          className={styles.search}
          value={searchBackdropQuery}
          onChange={setSearchBackdropQuery}
          onReset={handleSearchBackdropInputReset}
          placeholder={lang('Search')}
        />
        <MenuItem icon="select" onClick={handleSelectedAllBackdropsClick}>
          {lang('ContextMenuItemSelectAll')}
        </MenuItem>
        {backdrops.map((backdrop) => {
          const isSelected = isSelectedAll
            || selectedAttributes.some((attr) => attr.backdropId === backdrop.backdropId);

          return (
            <MenuItem
              key={backdrop.name}
              onClick={() => {
                handleBackdropMenuItemClick(backdrop);
              }}
            >
              <RadialPatternBackground
                className={styles.backdrop}
                backgroundColors={[backdrop.centerColor, backdrop.edgeColor]}
              />
              <div className={styles.backdropAttributeMenuItemText}>
                {backdrop.name}
                <span className={styles.menuItemCount}>
                  {lang.number(countersMap.backdrop.get(backdrop.backdropId) || 0)}
                </span>
              </div>
              <Icon
                className={styles.menuItemIcon}
                name={isSelected ? 'check' : 'placeholder'}
              />
            </MenuItem>
          );
        })}
      </div>
    );
  }

  function renderBackdropMenu() {
    return (
      <Menu
        isOpen={isBackdropContextMenuOpen}
        anchor={backdropContextMenuAnchor}
        ref={backdropMenuRef}
        className={buildClassName(styles.menu, styles.right, 'with-menu-transitions')}
        getMenuElement={getBackdropMenuElement}
        autoClose
        onClose={handleBackdropContextMenuClose}
        onCloseAnimationEnd={handleBackdropContextMenuHide}
        positionX="right"
      >
        {renderBackdropMenuItems()}
      </Menu>
    );
  }

  function renderPatternMenuItems() {
    const patterns = filteredAndSearchedAttributes.pattern;
    const selectedAttributes = filter.patternAttributes ?? [];
    const isSelectedAll = selectedAttributes.length === 0;

    return (
      <div className={styles.menuContentContainer}>
        <SearchInput
          onClick={handleSearchInputClick}
          className={styles.search}
          value={searchPatternQuery}
          onChange={setSearchPatternQuery}
          onReset={handleSearchPatternInputReset}
          placeholder={lang('Search')}
        />
        <MenuItem icon="select" onClick={handleSelectedAllPatternsClick}>
          {lang('ContextMenuItemSelectAll')}
        </MenuItem>
        {patterns.map((pattern) => {
          const isSelected = isSelectedAll
            || selectedAttributes.some((attr) => attr.documentId === pattern.sticker.id);

          return (
            <MenuItem
              key={pattern.name}
              onClick={() => {
                handlePatternMenuItemClick(pattern);
              }}
            >

              <ResaleGiftMenuAttributeSticker
                className={styles.sticker}
                sticker={pattern.sticker}
                type="pattern"
              />

              <div className={styles.menuItemStickerText}>
                {pattern.name}
                <span className={styles.menuItemCount}>
                  {lang.number(countersMap.pattern.get(pattern.sticker.id) || 0)}
                </span>
              </div>
              <Icon
                className={styles.menuItemIcon}
                name={isSelected ? 'check' : 'placeholder'}
              />
            </MenuItem>
          );
        })}
      </div>
    );
  }

  function renderPatternMenu() {
    return (
      <Menu
        isOpen={isPatternContextMenuOpen}
        anchor={patternContextMenuAnchor}
        ref={patternMenuRef}
        className={buildClassName(styles.menu, styles.right, 'with-menu-transitions')}
        getMenuElement={getPatternMenuElement}
        autoClose
        onClose={handlePatternContextMenuClose}
        onCloseAnimationEnd={handlePatternContextMenuHide}
      >
        {renderPatternMenuItems()}
      </Menu>
    );
  }

  return (
    <div className={buildClassName(styles.root, className)}>
      {Boolean(sortContextMenuAnchor) && renderSortMenu()}
      {Boolean(modelContextMenuAnchor) && renderModelMenu()}
      {Boolean(backdropContextMenuAnchor) && renderBackdropMenu()}
      {Boolean(patternContextMenuAnchor) && renderPatternMenu()}
      <div className={styles.buttonsContainer}>
        <SortMenuButton
          onTrigger={handleSortContextMenu}
          isOpen={isSortContextMenuOpen}
        />
        <ModelMenuButton
          onTrigger={handleModelContextMenu}
          isOpen={isModelContextMenuOpen}
        />
        <BackdropMenuButton
          onTrigger={handleBackdropContextMenu}
          isOpen={isBackdropContextMenuOpen}
        />
        <PatternMenuButton
          onTrigger={handlePatternContextMenu}
          isOpen={isPatternContextMenuOpen}
        />
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global, { filterType }): Complete<StateProps> => {
  const tabState = selectTabState(global);

  if (filterType === 'craft') {
    const craftModal = tabState.giftCraftModal;
    return {
      filter: craftModal?.marketFilter || DEFAULT_CRAFT_FILTER,
      attributes: craftModal?.marketAttributes,
      counters: craftModal?.marketCounters,
    };
  }

  const { resaleGifts } = tabState;
  return {
    filter: resaleGifts.filter,
    attributes: resaleGifts.attributes,
    counters: resaleGifts.counters,
  };
})(GiftResaleFilters));
