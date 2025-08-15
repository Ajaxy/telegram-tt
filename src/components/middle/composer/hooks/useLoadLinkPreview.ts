import { useEffect, useRef } from '@teact';
import { getActions } from '../../../../global';

import type { ThreadId } from '../../../../types';
import type { Signal } from '../../../../util/signals';
import {
  type ApiFormattedText,
  type ApiMessageEntityTextUrl,
  ApiMessageEntityTypes,
} from '../../../../api/types';

import { RE_LINK_TEMPLATE } from '../../../../config';
import parseHtmlAsFormattedText from '../../../../util/parseHtmlAsFormattedText';

import { useDebouncedResolver } from '../../../../hooks/useAsyncResolvers';
import useDerivedSignal from '../../../../hooks/useDerivedSignal';
import useSyncEffect from '../../../../hooks/useSyncEffect';

const DEBOUNCE_MS = 300;
const RE_LINK = new RegExp(RE_LINK_TEMPLATE, 'i');

export default function useLoadLinkPreview({
  getHtml,
  chatId,
  threadId,
}: {
  chatId: string;
  threadId: ThreadId;
  getHtml: Signal<string>;
}) {
  const {
    loadWebPagePreview,
    clearWebPagePreview,
    toggleMessageWebPage,
  } = getActions();

  const formattedTextWithLinkRef = useRef<ApiFormattedText>();

  const detectLinkDebounced = useDebouncedResolver(() => {
    const formattedText = parseHtmlAsFormattedText(getHtml());
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
}
