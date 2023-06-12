import React, { memo, useEffect, useRef } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type {
  ApiFormattedText, ApiMessage, ApiMessageEntityTextUrl, ApiWebPage,
} from '../../../api/types';
import { ApiMessageEntityTypes } from '../../../api/types';
import type { ISettings } from '../../../types';
import type { Signal } from '../../../util/signals';

import { RE_LINK_TEMPLATE } from '../../../config';
import { selectTabState, selectNoWebPage, selectTheme } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import parseMessageInput from '../../../util/parseMessageInput';

import useLastCallback from '../../../hooks/useLastCallback';
import useSyncEffect from '../../../hooks/useSyncEffect';
import useShowTransition from '../../../hooks/useShowTransition';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useDerivedState from '../../../hooks/useDerivedState';
import useDerivedSignal from '../../../hooks/useDerivedSignal';
import { useDebouncedResolver } from '../../../hooks/useAsyncResolvers';

import WebPage from '../message/WebPage';
import Button from '../../ui/Button';

import './WebPagePreview.scss';

type OwnProps = {
  chatId: string;
  threadId: number;
  getHtml: Signal<string>;
  isDisabled?: boolean;
};

type StateProps = {
  webPagePreview?: ApiWebPage;
  noWebPage?: boolean;
  theme: ISettings['theme'];
};

const DEBOUNCE_MS = 300;
const RE_LINK = new RegExp(RE_LINK_TEMPLATE, 'i');

const WebPagePreview: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  getHtml,
  isDisabled,
  webPagePreview,
  noWebPage,
  theme,
}) => {
  const {
    loadWebPagePreview,
    clearWebPagePreview,
    toggleMessageWebPage,
  } = getActions();

  const formattedTextWithLinkRef = useRef<ApiFormattedText>();

  const detectLinkDebounced = useDebouncedResolver(() => {
    const formattedText = parseMessageInput(getHtml());
    const linkEntity = formattedText.entities?.find((entity): entity is ApiMessageEntityTextUrl => (
      entity.type === ApiMessageEntityTypes.TextUrl
    ));

    formattedTextWithLinkRef.current = formattedText;

    return linkEntity?.url || formattedText.text.match(RE_LINK)?.[0];
  }, [getHtml], DEBOUNCE_MS, true);

  const getLink = useDerivedSignal(detectLinkDebounced, [detectLinkDebounced, getHtml], true);

  useEffect(() => {
    const link = getLink();
    const formattedText = formattedTextWithLinkRef.current;

    if (link) {
      loadWebPagePreview({ text: formattedText! });
    } else {
      clearWebPagePreview();
      toggleMessageWebPage({ chatId, threadId });
    }
  }, [getLink, chatId, threadId]);

  useSyncEffect(() => {
    clearWebPagePreview();
    toggleMessageWebPage({ chatId, threadId });
  }, [chatId, clearWebPagePreview, threadId, toggleMessageWebPage]);

  const isShown = useDerivedState(() => {
    return Boolean(webPagePreview && getHtml() && !noWebPage && !isDisabled);
  }, [isDisabled, getHtml, noWebPage, webPagePreview]);
  const { shouldRender, transitionClassNames } = useShowTransition(isShown);

  const renderingWebPage = useCurrentOrPrev(webPagePreview, true);

  const handleClearWebpagePreview = useLastCallback(() => {
    toggleMessageWebPage({ chatId, threadId, noWebPage: true });
  });

  if (!shouldRender || !renderingWebPage) {
    return undefined;
  }

  // TODO Refactor so `WebPage` can be used without message
  const { photo, ...webPageWithoutPhoto } = renderingWebPage;
  const messageStub = {
    content: {
      webPage: webPageWithoutPhoto,
    },
  } as ApiMessage;

  return (
    <div className={buildClassName('WebPagePreview', transitionClassNames)}>
      <div className="WebPagePreview_inner">
        <div className="WebPagePreview-left-icon">
          <i className="icon icon-link" />
        </div>
        <WebPage message={messageStub} inPreview theme={theme} />
        <Button
          className="WebPagePreview-clear"
          round
          faded
          color="translucent"
          ariaLabel="Clear Webpage Preview"
          onClick={handleClearWebpagePreview}
        >
          <i className="icon icon-close" />
        </Button>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, threadId }): StateProps => {
    const noWebPage = selectNoWebPage(global, chatId, threadId);
    return {
      theme: selectTheme(global),
      webPagePreview: selectTabState(global).webPagePreview,
      noWebPage,
    };
  },
)(WebPagePreview));
