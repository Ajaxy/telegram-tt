import React, {
  FC, memo, useEffect, useMemo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { ApiMessage, ApiMessageEntityTypes, ApiWebPage } from '../../../api/types';

import { selectNoWebPage } from '../../../modules/selectors';
import { pick } from '../../../util/iteratees';
import parseMessageInput from './helpers/parseMessageInput';
import useOnChange from '../../../hooks/useOnChange';

import WebPage from '../message/WebPage';
import Button from '../../ui/Button';

import './WebPagePreview.scss';

type OwnProps = {
  chatId: number;
  threadId: number;
  messageText: string;
};

type StateProps = {
  webPagePreview?: ApiWebPage;
  noWebPage?: boolean;
};
type DispatchProps = Pick<GlobalActions, 'loadWebPagePreview' | 'clearWebPagePreview' | 'toggleMessageWebPage'>;

const RE_LINK = /https?:\/\/(www.)?([a-zA-Z0-9.-]{2,256})([a-zA-Z/.-]{1,256})([?|#][=&#a-zA-Z0-9]{2,128})?/;

const WebPagePreview: FC<OwnProps & StateProps & DispatchProps> = ({
  chatId,
  threadId,
  messageText,
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

  const handleClearWebpagePreview = () => {
    toggleMessageWebPage({ chatId, threadId, noWebPage: true });
  };

  if (!webPagePreview || !messageText.length || noWebPage) {
    return undefined;
  }

  // TODO Refactor so `WebPage` can be used without message
  const { photo, ...webPageWithoutPhoto } = webPagePreview;
  const messageStub = {
    content: {
      webPage: webPageWithoutPhoto,
    },
  } as ApiMessage;

  return (
    <div className="WebPagePreview">
      <Button round color="translucent" ariaLabel="Clear Webpage Preview" onClick={handleClearWebpagePreview}>
        <i className="icon-close" />
      </Button>
      <WebPage message={messageStub} inPreview />
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
