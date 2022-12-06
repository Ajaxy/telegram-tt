import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../lib/teact/teact';

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
  'CustomEmoji',
  'Stickers',
  'GIFs',
}

export const SYMBOL_MENU_TAB_TITLES: Record<SymbolMenuTabs, string> = {
  [SymbolMenuTabs.Emoji]: 'Emoji',
  [SymbolMenuTabs.CustomEmoji]: 'StickersList.EmojiItem',
  [SymbolMenuTabs.Stickers]: 'AccDescrStickers',
  [SymbolMenuTabs.GIFs]: 'GifsTab',
};

const SYMBOL_MENU_TAB_ICONS = {
  [SymbolMenuTabs.Emoji]: 'icon-smile',
  [SymbolMenuTabs.CustomEmoji]: 'icon-favorite',
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
        // eslint-disable-next-line react/jsx-no-bind
        onClick={() => onSwitchTab(tab)}
        ariaLabel={lang(SYMBOL_MENU_TAB_TITLES[tab])}
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
      {activeTab !== SymbolMenuTabs.Emoji && activeTab !== SymbolMenuTabs.CustomEmoji && (
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
      {renderTabButton(SymbolMenuTabs.CustomEmoji)}
      {renderTabButton(SymbolMenuTabs.Stickers)}
      {renderTabButton(SymbolMenuTabs.GIFs)}

      {(activeTab === SymbolMenuTabs.Emoji || activeTab === SymbolMenuTabs.CustomEmoji) && (
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
