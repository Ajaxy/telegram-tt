import { memo, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiWebPageFull } from '../../../api/types';
import type { ThemeKey } from '../../../types';

import { TME_LINK_PREFIX } from '../../../config';
import { getInstantViewBrowserTabKey } from '../../../global/helpers';
import { selectFullWebPage, selectTheme } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useAppLayout from '../../../hooks/useAppLayout';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Surface, { Breakout } from '../../gili/layout/Surface';
import RichContent from '../../iv/RichContent';
import Link from '../../ui/Link';

import styles from './InstantViewTab.module.scss';

const PREVIEWS_BOT_USERNAME = 'previews';
const PREVIEWS_START_PARAM_PREFIX = 'webpage';

type OwnProps = {
  webPageId: string;
  fontSizeAdjust: number;
  isActive?: boolean;
};

type StateProps = {
  webPage?: ApiWebPageFull;
  theme: ThemeKey;
};

const InstantViewTab = ({
  webPageId,
  webPage,
  theme,
  fontSizeAdjust,
  isActive,
}: OwnProps & StateProps) => {
  const {
    changeBrowserModalState, closeBrowserTab, loadWebPage, openChatByUsername, openTelegramLink,
  } = getActions();
  const lang = useLang();
  const { isMobile } = useAppLayout();

  const renderingWebPage = useCurrentOrPrev(webPage);
  const page = renderingWebPage?.cachedPage;
  const previewsStartParam = renderingWebPage?.id
    ? `${PREVIEWS_START_PARAM_PREFIX}${renderingWebPage.id}`
    : undefined;
  const instantViewTabKey = getInstantViewBrowserTabKey(webPageId);

  useEffect(() => {
    if (!renderingWebPage?.url || !page?.isPart) return;

    loadWebPage({ url: renderingWebPage.url });
  }, [page?.isPart, renderingWebPage?.url]);

  const closeOrMinimizeInstantView = useLastCallback(() => {
    if (isMobile) {
      closeBrowserTab({ key: instantViewTabKey });
    } else {
      changeBrowserModalState({ state: 'minimized' });
    }
  });

  const handleOpenTelegramLink = useLastCallback((url: string) => {
    closeOrMinimizeInstantView();
    openTelegramLink({ url });
  });

  const handleTelegramChannelClick = useLastCallback((channelUsername: string) => {
    handleOpenTelegramLink(`${TME_LINK_PREFIX}${channelUsername}`);
  });

  const handleWrongLayoutClick = useLastCallback((e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (!previewsStartParam) return;

    e.preventDefault();
    closeOrMinimizeInstantView();
    openChatByUsername({
      username: PREVIEWS_BOT_USERNAME,
      startParam: previewsStartParam,
    });
  });

  if (!page) return undefined;

  const viewsText = page.views !== undefined
    ? lang('ChannelStatsViewsCount', { count: lang.number(page.views) }, { pluralValue: page.views })
    : undefined;
  const hasCover = page.blocks[0]?.type === 'cover';

  return (
    <Surface scrollable noPadding className={buildClassName(styles.root, !isActive && styles.hidden)}>
      <article key={page.url} className={styles.article}>
        <div className={buildClassName(styles.content, hasCover && styles.contentWithCover)}>
          <RichContent
            blocks={page.blocks}
            isRtl={page.isRtl}
            pageUrl={page.url}
            noAvatars
            canAutoLoadMedia
            theme={theme}
            fontSizeAdjust={fontSizeAdjust}
            onTelegramChannelClick={handleTelegramChannelClick}
          />
        </div>
        <Breakout className={styles.footerBreakout}>
          <footer className={styles.footer}>
            <span className={styles.viewsCounter}>{viewsText}</span>
            <Link
              className={styles.reportLink}
              onClick={handleWrongLayoutClick}
            >
              {lang('InstantViewWrongLayout')}
            </Link>
          </footer>
        </Breakout>
      </article>
    </Surface>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { webPageId }): Complete<StateProps> => {
    return {
      webPage: selectFullWebPage(global, webPageId),
      theme: selectTheme(global),
    };
  },
)(InstantViewTab));
