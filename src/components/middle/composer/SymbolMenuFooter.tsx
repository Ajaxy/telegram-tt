import { memo } from '../../../lib/teact/teact';

import type { RegularLangKey } from '../../../types/language';

import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';

type OwnProps = {
  activeTab: SymbolMenuTabs;
  onSwitchTab: (tab: SymbolMenuTabs) => void;
  onRemoveSymbol: () => void;
  isAttachmentModal?: boolean;
  canSendPlainText?: boolean;
};

export enum SymbolMenuTabs {
  Emoji,
  Stickers,
  GIFs,
}

export const SYMBOL_MENU_TAB_TITLES: Record<SymbolMenuTabs, RegularLangKey> = {
  [SymbolMenuTabs.Emoji]: 'Emoji',
  [SymbolMenuTabs.Stickers]: 'AccDescrStickers',
  [SymbolMenuTabs.GIFs]: 'GifsTab2',
};

const SYMBOL_MENU_TAB_ICONS = {
  [SymbolMenuTabs.Emoji]: 'icon-smile',
  [SymbolMenuTabs.Stickers]: 'icon-stickers',
  [SymbolMenuTabs.GIFs]: 'icon-gifs',
};

const SymbolMenuFooter = ({
  activeTab, onSwitchTab, onRemoveSymbol, isAttachmentModal, canSendPlainText,
}: OwnProps) => {
  const lang = useLang();

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

  function stopPropagation(event: any) {
    event.stopPropagation();
  }

  return (
    <div className="SymbolMenu-footer" onClick={stopPropagation} dir={lang.isRtl ? 'rtl' : undefined}>
      {canSendPlainText && renderTabButton(SymbolMenuTabs.Emoji)}
      {!isAttachmentModal && renderTabButton(SymbolMenuTabs.Stickers)}
      {!isAttachmentModal && renderTabButton(SymbolMenuTabs.GIFs)}

      {activeTab === SymbolMenuTabs.Emoji && (
        <Button
          className="symbol-delete-button"
          onClick={onRemoveSymbol}
          ariaLabel={lang('RemoveSymbol')}
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
