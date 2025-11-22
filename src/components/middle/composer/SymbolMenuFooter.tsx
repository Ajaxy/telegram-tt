import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Button from '../../ui/Button';

type OwnProps = {
  activeTab: SymbolMenuTabs;
  onSwitchTab: (tab: SymbolMenuTabs) => void;
  onRemoveSymbol: () => void;
  onSearchOpen: (type: 'stickers' | 'gifs') => void;
  isAttachmentModal?: boolean;
  canSendPlainText?: boolean;
  canSearch?: boolean;
};

export enum SymbolMenuTabs {
  Emoji,
  CustomEmoji,
  Stickers,
  GIFs,
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
  activeTab, onSwitchTab, onRemoveSymbol, onSearchOpen, isAttachmentModal,
  canSendPlainText, canSearch,
}) => {
  const lang = useOldLang();

  function renderTabButton(tab: SymbolMenuTabs) {
    return (
      <Button
        className={`symbol-tab-button ${activeTab === tab ? 'activated' : ''}`}

        onClick={() => onSwitchTab(tab)}
        ariaLabel={lang(SYMBOL_MENU_TAB_TITLES[tab])}
        round
        faded
        color="translucent"
      >
        <i className={buildClassName('icon', SYMBOL_MENU_TAB_ICONS[tab])} />
      </Button>
    );
  }

  const handleSearchOpen = useLastCallback(() => {
    onSearchOpen(activeTab === SymbolMenuTabs.Stickers ? 'stickers' : 'gifs');
  });

  function stopPropagation(event: any) {
    event.stopPropagation();
  }

  return (
    <div className="SymbolMenu-footer" onClick={stopPropagation} dir={lang.isRtl ? 'rtl' : undefined}>
      {activeTab !== SymbolMenuTabs.Emoji && activeTab !== SymbolMenuTabs.CustomEmoji && canSearch && (
        <Button
          className="symbol-search-button"
          ariaLabel={activeTab === SymbolMenuTabs.Stickers ? 'Search Stickers' : 'Search GIFs'}
          round
          faded
          color="translucent"
          onClick={handleSearchOpen}
          iconName="search"
        />
      )}

      {canSendPlainText && renderTabButton(SymbolMenuTabs.Emoji)}
      {canSendPlainText && renderTabButton(SymbolMenuTabs.CustomEmoji)}
      {!isAttachmentModal && renderTabButton(SymbolMenuTabs.Stickers)}
      {!isAttachmentModal && renderTabButton(SymbolMenuTabs.GIFs)}

      {(activeTab === SymbolMenuTabs.Emoji || activeTab === SymbolMenuTabs.CustomEmoji) && (
        <Button
          className="symbol-delete-button"
          onClick={onRemoveSymbol}
          ariaLabel="Remove Symbol"
          round
          faded
          color="translucent"
          iconName="delete-left"
        />
      )}
    </div>
  );
};

export default memo(SymbolMenuFooter);
