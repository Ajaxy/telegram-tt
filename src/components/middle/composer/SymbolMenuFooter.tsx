import React, { FC, memo, useCallback } from '../../../lib/teact/teact';

import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';

type OwnProps = {
  activeTab: SymbolMenuTabs;
  onSwitchTab: (tab: SymbolMenuTabs) => void;
  onRemoveSymbol: () => void;
  onSearchOpen: (type: 'stickers' | 'gifs') => void;
};

export enum SymbolMenuTabs {
  'Emoji',
  'Stickers',
  'GIFs',
}

// Getting enum string values for display in Tabs.
// See: https://www.typescriptlang.org/docs/handbook/enums.html#reverse-mappings
export const SYMBOL_MENU_TAB_TITLES = Object.values(SymbolMenuTabs)
  .filter((value): value is string => typeof value === 'string');

const SYMBOL_MENU_TAB_ICONS = {
  [SymbolMenuTabs.Emoji]: 'icon-smile',
  [SymbolMenuTabs.Stickers]: 'icon-stickers',
  [SymbolMenuTabs.GIFs]: 'icon-gifs',
};

const SymbolMenuFooter: FC<OwnProps> = ({
  activeTab, onSwitchTab, onRemoveSymbol, onSearchOpen,
}) => {
  const lang = useLang();

  function renderTabButton(tab: SymbolMenuTabs) {
    return (
      <Button
        className={`symbol-tab-button ${activeTab === tab ? 'activated' : ''}`}
        onClick={() => onSwitchTab(tab)}
        ariaLabel={SYMBOL_MENU_TAB_TITLES[tab]}
        round
        faded
        color="translucent"
      >
        <i className={SYMBOL_MENU_TAB_ICONS[tab]} />
      </Button>
    );
  }

  const handleSearchOpen = useCallback(() => {
    onSearchOpen(activeTab === SymbolMenuTabs.Stickers ? 'stickers' : 'gifs');
  }, [activeTab, onSearchOpen]);

  function stopPropagation(event: any) {
    event.stopPropagation();
  }

  return (
    <div className="SymbolMenu-footer" onClick={stopPropagation} dir={lang.isRtl ? 'rtl' : undefined}>
      {activeTab !== SymbolMenuTabs.Emoji && (
        <Button
          className="symbol-search-button"
          ariaLabel={activeTab === SymbolMenuTabs.Stickers ? 'Search Stickers' : 'Search GIFs'}
          round
          faded
          color="translucent"
          onClick={handleSearchOpen}
        >
          <i className="icon-search" />
        </Button>
      )}

      {renderTabButton(SymbolMenuTabs.Emoji)}
      {renderTabButton(SymbolMenuTabs.Stickers)}
      {renderTabButton(SymbolMenuTabs.GIFs)}

      {activeTab === SymbolMenuTabs.Emoji && (
        <Button
          className="symbol-delete-button"
          onClick={onRemoveSymbol}
          ariaLabel="Remove Symbol"
          round
          faded
          color="translucent"
        >
          <i className="icon-delete-left" />
        </Button>
      )}
    </div>
  );
};

export default memo(SymbolMenuFooter);
