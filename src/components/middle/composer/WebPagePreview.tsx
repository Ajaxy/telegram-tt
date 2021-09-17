import React, {
  FC, memo, useEffect, useMemo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { ApiMessage, ApiMessageEntityTypes, ApiWebPage } from '../../../api/types';

import { RE_LINK_TEMPLATE } from '../../../config';
import { selectNoWebPage } from '../../../modules/selectors';
import { pick } from '../../../util/iteratees';
import parseMessageInput from './helpers/parseMessageInput';
import useOnChange from '../../../hooks/useOnChange';
import useShowTransition from '../../../hooks/useShowTransition';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import buildClassName from '../../../util/buildClassName';

import WebPage from '../message/WebPage';
import Button from '../../ui/Button';

import './WebPagePreview.scss';

type OwnProps = {
  chatId: number;
  threadId: number;
  messageText: string;
  disabled?: boolean;
};

type StateProps = {
  webPagePreview?: ApiWebPage;
  noWebPage?: boolean;
};
type DispatchProps = Pick<GlobalActions, 'loadWebPagePreview' | 'clearWebPagePreview' | 'toggleMessageWebPage'>;

const RE_LINK = new RegExp(RE_LINK_TEMPLATE, 'i');

const WebPagePreview: FC<OwnProps & StateProps & DispatchProps> = ({
  chatId,
  threadId,
  messageText,
  disabled,
  webPagePreview,
  noWebPage,
  loadWebPagePreview,
  clearWebPagePreview,
  toggleMessageWebPage,
}) => {
  const link = useMemo(() => {
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
  }, [messageText]);

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

  if (!shouldRender || !renderingWebPage) {
    return undefined;
  }

  const handleClearWebpagePreview = () => {
    toggleMessageWebPage({ chatId, threadId, noWebPage: true });
  };

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
        <WebPage message={messageStub} inPreview />
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, threadId }): StateProps => {
    const noWebPage = selectNoWebPage(global, chatId, threadId);
    return {
      webPagePreview: global.webPagePreview,
      noWebPage,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'loadWebPagePreview', 'clearWebPagePreview', 'toggleMessageWebPage',
  ]),
)(WebPagePreview));
