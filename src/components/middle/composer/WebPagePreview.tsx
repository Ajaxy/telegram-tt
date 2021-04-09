import React, {
  FC, memo, useEffect, useMemo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions, GlobalState } from '../../../global/types';
import { ApiMessage, ApiMessageEntityTypes } from '../../../api/types';

import { pick } from '../../../util/iteratees';
import parseMessageInput from './helpers/parseMessageInput';
import useOnChange from '../../../hooks/useOnChange';

import WebPage from '../message/WebPage';

import './WebPagePreview.scss';

type OwnProps = {
  chatId: number;
  messageText: string;
};

type StateProps = Pick<GlobalState, 'webPagePreview'>;
type DispatchProps = Pick<GlobalActions, 'loadWebPagePreview' | 'clearWebPagePreview'>;

const RE_LINK = /https?:\/\/(www.)?([a-zA-Z0-9.-]{2,256})([a-zA-Z/.-]{1,256})([?|#][=&#a-zA-Z0-9]{2,128})?/;

const WebPagePreview: FC<OwnProps & StateProps & DispatchProps> = ({
  chatId,
  messageText,
  webPagePreview,
  loadWebPagePreview,
  clearWebPagePreview,
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
    }
  }, [clearWebPagePreview, link, loadWebPagePreview]);

  useOnChange(() => {
    clearWebPagePreview();
  }, [chatId]);

  if (!webPagePreview || !messageText.length) {
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
      <WebPage message={messageStub} inPreview />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => pick(global, ['webPagePreview']),
  (setGlobal, actions): DispatchProps => pick(actions, ['loadWebPagePreview', 'clearWebPagePreview']),
)(WebPagePreview));
