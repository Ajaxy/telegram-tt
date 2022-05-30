import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiMessage, ApiWebPage } from '../../../api/types';
import { ApiMessageEntityTypes } from '../../../api/types';
import type { ISettings } from '../../../types';

import { RE_LINK_TEMPLATE } from '../../../config';
import { selectNoWebPage, selectTheme } from '../../../global/selectors';
import parseMessageInput from '../../../util/parseMessageInput';
import useOnChange from '../../../hooks/useOnChange';
import useShowTransition from '../../../hooks/useShowTransition';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useDebouncedMemo from '../../../hooks/useDebouncedMemo';
import buildClassName from '../../../util/buildClassName';

import WebPage from '../message/WebPage';
import Button from '../../ui/Button';

import './WebPagePreview.scss';

type OwnProps = {
  chatId: string;
  threadId: number;
  messageText: string;
  disabled?: boolean;
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
  messageText,
  disabled,
  webPagePreview,
  noWebPage,
  theme,
}) => {
  const {
    loadWebPagePreview,
    clearWebPagePreview,
    toggleMessageWebPage,
  } = getActions();

  const link = useDebouncedMemo(() => {
    const { text, entities } = parseMessageInput(messageText);

    const linkEntity = entities && entities.find(({ type }) => type === ApiMessageEntityTypes.TextUrl);
    if (linkEntity) {
      return linkEntity.url;
    }

    const textMatch = text.match(RE_LINK);
    if (textMatch) {
      return textMatch[0];
    }

    return undefined;
  }, DEBOUNCE_MS, [messageText]);

  useEffect(() => {
    if (link) {
      loadWebPagePreview({ text: link });
    } else {
      clearWebPagePreview();
      toggleMessageWebPage({ chatId, threadId });
    }
  }, [chatId, toggleMessageWebPage, clearWebPagePreview, link, loadWebPagePreview, threadId]);

  useOnChange(() => {
    clearWebPagePreview();
    toggleMessageWebPage({ chatId, threadId });
  }, [chatId]);

  const isShown = Boolean(webPagePreview && messageText.length && !noWebPage && !disabled);
  const { shouldRender, transitionClassNames } = useShowTransition(isShown);

  const renderingWebPage = useCurrentOrPrev(webPagePreview, true);

  const handleClearWebpagePreview = useCallback(() => {
    toggleMessageWebPage({ chatId, threadId, noWebPage: true });
  }, [chatId, threadId, toggleMessageWebPage]);

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
      <div>
        <Button round faded color="translucent" ariaLabel="Clear Webpage Preview" onClick={handleClearWebpagePreview}>
          <i className="icon-close" />
        </Button>
        <WebPage message={messageStub} inPreview theme={theme} />
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, threadId }): StateProps => {
    const noWebPage = selectNoWebPage(global, chatId, threadId);
    return {
      theme: selectTheme(global),
      webPagePreview: global.webPagePreview,
      noWebPage,
    };
  },
)(WebPagePreview));
