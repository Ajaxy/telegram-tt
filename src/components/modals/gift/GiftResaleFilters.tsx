import { type MouseEvent as ReactMouseEvent } from 'react';
import type { ElementRef, FC } from '../../../lib/teact/teact';
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

type OwnProps = {
  dialogRef: ElementRef<HTMLDivElement>;
};
type StateProps = {
  filter: ResaleGiftsFilterOptions;
  attributes?: ApiStarGiftAttribute[];
  counters?: ApiStarGiftAttributeCounter[];
};

const GiftResaleFilters: FC<StateProps & OwnProps> = ({
  attributes,
  counters,
  filter,
  dialogRef,
}) => {
  const lang = useLang();
  const {
    updateResaleGiftsFilter,
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

  const SortMenuButton: FC<{ onTrigger: (e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => void; isOpen?: boolean }>
    = useMemo(() => {
      const sortType = filter.sortType;
      return ({ onTrigger, isOpen: isMenuOpen }) => (
        <div
          className={styles.item}
          onClick={onTrigger}
        >
          {sortType === 'byDate' && lang('ValueGiftSortByDate')}
          {sortType === 'byNumber' && lang('ValueGiftSortByNumber')}
          {sortType === 'byPrice' && lang('ValueGiftSortByPrice')}
          <Icon
            name="dropdown-arrows"
            className={styles.itemIcon}
          />
        </div>
      );
    }, [lang, filter]);

  const ModelMenuButton:
  FC<{ onTrigger: (e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => void; isOpen?: boolean }>
    = useMemo(() => {
      const attributesCount = filter?.modelAttributes?.length || 0;
      return ({ onTrigger, isOpen: isMenuOpen }) => (
        <div
          className={styles.item}
          onClick={onTrigger}
        >
          {attributesCount === 0 && lang('GiftAttributeModel')}
          {attributesCount > 0
            && lang('GiftAttributeModelPlural', { count: attributesCount }, { pluralValue: attributesCount })}
          <Icon
            name="dropdown-arrows"
            className={styles.itemIcon}
          />
        </div>
      );
    }, [lang, filter]);
  const BackdropMenuButton:
  FC<{ onTrigger: (e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => void; isOpen?: boolean }>
    = useMemo(() => {
      const attributesCount = filter?.backdropAttributes?.length || 0;
      return ({ onTrigger, isOpen: isMenuOpen }) => (
        <div
          className={styles.item}
          onClick={onTrigger}
        >
          {attributesCount === 0 && lang('GiftAttributeBackdrop')}
          {attributesCount > 0
            && lang('GiftAttributeBackdropPlural', { count: attributesCount }, { pluralValue: attributesCount })}
          <Icon
            name="dropdown-arrows"
            className={styles.itemIcon}
          />
        </div>
      );
    }, [lang, filter]);
  const PatternMenuButton: FC<{ onTrigger: (e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => void; isOpen?: boolean }>
    = useMemo(() => {
      const attributesCount = filter?.patternAttributes?.length || 0;
      return ({ onTrigger, isOpen: isMenuOpen }) => (
        <div
          className={styles.item}
          onClick={onTrigger}
        >
          {attributesCount === 0 && lang('GiftAttributeSymbol')}
          {attributesCount > 0
            && lang('GiftAttributeSymbolPlural', { count: attributesCount }, { pluralValue: attributesCount })}
          <Icon
            name="dropdown-arrows"
            className={styles.itemIcon}
          />
        </div>
      );
    }, [lang, filter]);

  const handleSortMenuItemClick = useLastCallback((type: ResaleGiftsSortType) => {
    updateResaleGiftsFilter({ filter: {
      ...filter,
      sortType: type,
    } });
  });

  const handleSelectedAllModelsClick = useLastCallback(() => {
    updateResaleGiftsFilter({ filter: {
      ...filter,
      modelAttributes: [],
    } });
  });
  const handleSelectedAllPatternsClick = useLastCallback(() => {
    updateResaleGiftsFilter({ filter: {
      ...filter,
      patternAttributes: [],
    } });
  });
  const handleSelectedAllBackdropsClick = useLastCallback(() => {
    updateResaleGiftsFilter({ filter: {
      ...filter,
      backdropAttributes: [],
    } });
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
    updateResaleGiftsFilter({ filter: {
      ...filter,
      modelAttributes: updatedAttributes,
    } });
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
    updateResaleGiftsFilter({ filter: {
      ...filter,
      patternAttributes: updatedAttributes,
    } });
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
    updateResaleGiftsFilter({ filter: {
      ...filter,
      backdropAttributes: updatedAttributes,
    } });
  });

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
        <MenuItem icon="select" onClick={handleSelectedAllModelsClick} disabled={isSelectedAll}>
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
        <MenuItem icon="select" onClick={handleSelectedAllBackdropsClick} disabled={isSelectedAll}>
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
        <MenuItem icon="select" onClick={handleSelectedAllPatternsClick} disabled={isSelectedAll}>
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
    <div className={styles.root}>
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

export default memo(withGlobal((global): Complete<StateProps> => {
  const { resaleGifts } = selectTabState(global);

  const attributes = resaleGifts.attributes;
  const counters = resaleGifts.counters;
  const filter = resaleGifts.filter;

  return {
    attributes,
    counters,
    filter,
  };
})(GiftResaleFilters));
