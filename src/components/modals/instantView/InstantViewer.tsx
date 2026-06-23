import { memo, useEffect, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiWebPageFull } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { ThemeKey } from '../../../types';

import { TME_LINK_PREFIX } from '../../../config';
import { selectFullWebPage, selectTheme } from '../../../global/selectors';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import { Breakout } from '../../gili/layout/Surface';
import RichContent from '../../iv/RichContent';
import Link from '../../ui/Link';
import Modal, {
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '@gili/modal/Modal';

import styles from './InstantViewer.module.scss';

export type OwnProps = {
  modal: TabState['instantViewModal'];
};

type StateProps = {
  webPage?: ApiWebPageFull;
  theme: ThemeKey;
};

const InstantViewer = ({
  modal,
  webPage,
  theme,
}: OwnProps & StateProps) => {
  const { closeInstantView, loadWebPage, openTelegramLink } = getActions();
  const lang = useLang();

  const renderingWebPage = useCurrentOrPrev(webPage);
  const page = renderingWebPage?.cachedPage;
  const isOpen = Boolean(modal && page);
  const previewBotUrl = renderingWebPage?.id
    ? `${TME_LINK_PREFIX}previews?start=webpage${renderingWebPage.id}`
    : undefined;

  useEffect(() => {
    if (!renderingWebPage?.url || !page?.isPart) return;

    loadWebPage({ url: renderingWebPage.url });
  }, [page?.isPart, renderingWebPage?.url]);

  const header = useMemo(() => (
    <ModalHeader>
      <ModalCloseButton />
      <ModalTitle>{lang('InstantView')}</ModalTitle>
    </ModalHeader>
  ), [lang]);

  const handleWrongLayoutClick = useLastCallback((e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (!previewBotUrl) return;

    e.preventDefault();
    closeInstantView();
    openTelegramLink({ url: previewBotUrl });
  });

  if (!page) return undefined;

  const viewsText = page.views !== undefined
    ? lang('ChannelStatsViewsCount', { count: lang.number(page.views) }, { pluralValue: page.views })
    : undefined;

  return (
    <Modal
      isOpen={isOpen}
      header={header}
      width="regular"
      height="tall"
      ariaLabel={lang('InstantView')}
      dialogClassName={styles.dialog}
      onClose={closeInstantView}
    >
      <article key={page.url} className={styles.article}>
        <div className={styles.content}>
          <RichContent
            blocks={page.blocks}
            isRtl={page.isRtl}
            pageUrl={page.url}
            noAvatars
            canAutoLoadMedia
            theme={theme}
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
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const webPage = modal?.webPageId ? selectFullWebPage(global, modal.webPageId) : undefined;

    return {
      webPage,
      theme: selectTheme(global),
    };
  },
)(InstantViewer));
