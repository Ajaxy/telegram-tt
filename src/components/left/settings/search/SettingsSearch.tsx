import { memo, useMemo, useRef } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { Signal } from '../../../../util/signals';
import type { MenuItemContextAction } from '../../../ui/ListItem';
import type { SettingsSearchItem } from './searchSettings';

import { selectSettingsSearchFlags } from '../../../../global/selectors';
import { IS_MOBILE } from '../../../../util/browser/windowEnvironment';
import buildClassName from '../../../../util/buildClassName';
import { copyTextToClipboard } from '../../../../util/clipboard';
import { buildSettingsSearchIndex, searchSettings } from './searchSettings';

import { useShallowSelector } from '../../../../hooks/data/useSelector';
import useAppLayout from '../../../../hooks/useAppLayout';
import useDerivedState from '../../../../hooks/useDerivedState';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import useKeyboardListNavigation from '../../../../hooks/useKeyboardListNavigation';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import NothingFound from '../../../common/NothingFound';
import Island, { IslandTitle } from '../../../gili/layout/Island';
import ListItem from '../../../ui/ListItem';

import styles from './SettingsSearch.module.scss';

type OwnProps = {
  isActive?: boolean;
  getQuery: Signal<string>;
  onSelect: (item: SettingsSearchItem) => void;
  onReset: NoneToVoidFunction;
};

type StateProps = {
  recentIds?: string[];
};

const ITEM_BUTTON_SELECTOR = '.ListItem-button';

const SettingsSearch = ({
  isActive,
  getQuery,
  recentIds,
  onSelect,
  onReset,
}: OwnProps & StateProps) => {
  const { removeRecentlyFoundSettingId, showNotification } = getActions();

  const lang = useLang();
  const { isMobile } = useAppLayout();
  const stateFlags = useShallowSelector(selectSettingsSearchFlags);
  const containerRef = useRef<HTMLDivElement>();
  const shownRecentIdsRef = useRef(recentIds || []);

  const query = useDerivedState(getQuery);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const index = useMemo(() => buildSettingsSearchIndex(lang, {
    ...stateFlags,
    isDesktopLayout: !isMobile,
    canSendWithKeyboard: !isMobile || !IS_MOBILE,
  }), [lang, isMobile, stateFlags]);

  const hasQuery = Boolean(query.trim());

  const items = useMemo(() => {
    if (hasQuery) return searchSettings(index, query);

    const shownIds = shownRecentIdsRef.current.filter((id) => recentIds?.includes(id));
    const newIds = recentIds?.filter((id) => !shownIds.includes(id)) || [];

    return [...shownIds, ...newIds].map((id) => index.find((item) => item.id === id)).filter(Boolean);
  }, [hasQuery, index, query, recentIds]);

  const handleSelectWithEnter = useLastCallback(() => {
    const buttons = Array.from(containerRef.current!.querySelectorAll(ITEM_BUTTON_SELECTOR));
    const item = items[buttons.indexOf(document.activeElement!)];
    if (item) onSelect(item);
  });

  const handleKeyDown = useKeyboardListNavigation(
    containerRef, Boolean(isActive), handleSelectWithEnter, ITEM_BUTTON_SELECTOR, true,
  );

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLElement>, item: SettingsSearchItem) => {
    onSelect(item);
  });

  function renderItem(item: SettingsSearchItem, i: number) {
    const isFirstInGroup = item.categoryScreen === undefined || item.categoryScreen !== items[i - 1]?.categoryScreen;
    const { link } = item;

    const contextActions: MenuItemContextAction[] = [];
    if (link) {
      contextActions.push({
        title: lang('CopyLink'),
        icon: 'link',
        handler: () => {
          copyTextToClipboard(link);
          showNotification({ message: lang('LinkCopied') });
        },
      });
    }
    if (recentIds?.includes(item.id)) {
      contextActions.push({
        title: lang('DeleteFromRecent'),
        icon: 'delete',
        handler: () => removeRecentlyFoundSettingId({ id: item.id }),
      });
    }

    return (
      <ListItem
        key={item.id}
        icon={item.icon}
        iconBg={item.iconBg}
        iconClassName={!isFirstInGroup ? styles.hiddenIcon : undefined}
        multiline={Boolean(item.path)}
        narrow
        contextActions={contextActions.length ? contextActions : undefined}
        clickArg={item}
        onClick={handleClick}
      >
        {item.path ? (
          <>
            <span className="title">{item.title}</span>
            <span className="subtitle">{item.path}</span>
          </>
        ) : item.title}
      </ListItem>
    );
  }

  return (
    <div
      ref={containerRef}
      className={buildClassName('settings-content custom-scroll SettingsSearch', styles.root)}
      onKeyDown={handleKeyDown}
    >
      {Boolean(items.length) && (
        <>
          {!hasQuery && <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('Recent')}</IslandTitle>}
          <Island>
            {items.map(renderItem)}
          </Island>
        </>
      )}
      {!items.length && (
        <NothingFound
          className={styles.placeholder}
          text={lang(hasQuery ? 'NothingFound' : 'SettingsSearchEmpty')}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      recentIds: global.recentlyFoundSettingIds,
    };
  },
)(SettingsSearch));
