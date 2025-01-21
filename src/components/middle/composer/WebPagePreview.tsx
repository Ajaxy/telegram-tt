import type { FC } from '../../../lib/teact/teact';
import React, { memo, useEffect, useRef } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiFormattedText, ApiMessage, ApiMessageEntityTextUrl, ApiWebPage,
} from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { ISettings, ThreadId, WebPageMediaSize } from '../../../types';
import type { Signal } from '../../../util/signals';
import { ApiMessageEntityTypes } from '../../../api/types';

import { RE_LINK_TEMPLATE } from '../../../config';
import { selectNoWebPage, selectTabState, selectTheme } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import parseHtmlAsFormattedText from '../../../util/parseHtmlAsFormattedText';

import { useDebouncedResolver } from '../../../hooks/useAsyncResolvers';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useDerivedSignal from '../../../hooks/useDerivedSignal';
import useDerivedState from '../../../hooks/useDerivedState';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';
import useSyncEffect from '../../../hooks/useSyncEffect';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import WebPage from '../message/WebPage';

import './WebPagePreview.scss';

type OwnProps = {
  chatId: string;
  threadId: ThreadId;
  getHtml: Signal<string>;
  isEditing: boolean;
  isDisabled?: boolean;
};

type StateProps = {
  webPagePreview?: ApiWebPage;
  noWebPage?: boolean;
  theme: ISettings['theme'];
  attachmentSettings: GlobalState['attachmentSettings'];
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
  attachmentSettings,
  isEditing,
}) => {
  const {
    loadWebPagePreview,
    clearWebPagePreview,
    toggleMessageWebPage,
    updateAttachmentSettings,
  } = getActions();

  const lang = useOldLang();

  const formattedTextWithLinkRef = useRef<ApiFormattedText>();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const isInvertedMedia = attachmentSettings.isInvertedMedia;
  const isSmallerMedia = attachmentSettings.webPageMediaSize === 'small';

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

  const isShown = useDerivedState(() => {
    return Boolean(webPagePreview && getHtml() && !noWebPage && !isDisabled);
  }, [isDisabled, getHtml, noWebPage, webPagePreview]);
  const { shouldRender, transitionClassNames } = useShowTransitionDeprecated(isShown);

  const hasMediaSizeOptions = webPagePreview?.hasLargeMedia;

  const renderingWebPage = useCurrentOrPrev(webPagePreview, true);

  const handleClearWebpagePreview = useLastCallback(() => {
    toggleMessageWebPage({ chatId, threadId, noWebPage: true });
  });

  const {
    isContextMenuOpen, contextMenuAnchor, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref, isEditing, true);

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => ref.current!);
  const getMenuElement = useLastCallback(
    () => ref.current!.querySelector('.web-page-preview-context-menu .bubble'),
  );

  const handlePreviewClick = useLastCallback((e: React.MouseEvent): void => {
    handleContextMenu(e);
  });

  useEffect(() => {
    if (!shouldRender || !renderingWebPage) {
      handleContextMenuClose();
      handleContextMenuHide();
    }
  }, [handleContextMenuClose, handleContextMenuHide, shouldRender, renderingWebPage]);

  function updateIsInvertedMedia(value?: true) {
    updateAttachmentSettings({ isInvertedMedia: value });
  }

  function updateIsLargerMedia(value?: WebPageMediaSize) {
    updateAttachmentSettings({ webPageMediaSize: value });
  }

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

  function renderContextMenu() {
    return (
      <Menu
        isOpen={isContextMenuOpen}
        anchor={contextMenuAnchor}
        getTriggerElement={getTriggerElement}
        getRootElement={getRootElement}
        getMenuElement={getMenuElement}
        className="web-page-preview-context-menu"
        onClose={handleContextMenuClose}
        onCloseAnimationEnd={handleContextMenuHide}
        autoClose
      >
        <>
          {
            isInvertedMedia ? (
              // eslint-disable-next-line react/jsx-no-bind
              <MenuItem icon="move-caption-up" onClick={() => updateIsInvertedMedia(undefined)}>
                {lang('PreviewSender.MoveTextUp')}
              </MenuItem>
            ) : (
            // eslint-disable-next-line react/jsx-no-bind
              <MenuItem icon="move-caption-down" onClick={() => updateIsInvertedMedia(true)}>
                {lang(('PreviewSender.MoveTextDown'))}
              </MenuItem>
            )
          }
          {hasMediaSizeOptions && (
            isSmallerMedia ? (
            // eslint-disable-next-line react/jsx-no-bind
              <MenuItem icon="expand" onClick={() => updateIsLargerMedia('large')}>
                {lang('ChatInput.EditLink.LargerMedia')}
              </MenuItem>
            ) : (
            // eslint-disable-next-line react/jsx-no-bind
              <MenuItem icon="collapse" onClick={() => updateIsLargerMedia('small')}>
                {lang(('ChatInput.EditLink.SmallerMedia'))}
              </MenuItem>
            )
          )}
          <MenuItem
            icon="delete"
            // eslint-disable-next-line react/jsx-no-bind
            onClick={handleClearWebpagePreview}
          >
            {lang('ChatInput.EditLink.RemovePreview')}
          </MenuItem>
        </>
      </Menu>
    );
  }

  return (
    <div className={buildClassName('WebPagePreview', transitionClassNames)} ref={ref}>
      <div className="WebPagePreview_inner">
        <div className="WebPagePreview-left-icon" onClick={handlePreviewClick}>
          <Icon name="link" />
        </div>
        <WebPage
          message={messageStub}
          inPreview
          theme={theme}
          onContainerClick={handlePreviewClick}
          isEditing={isEditing}
        />
        <Button
          className="WebPagePreview-clear"
          round
          faded
          color="translucent"
          ariaLabel="Clear Webpage Preview"
          onClick={handleClearWebpagePreview}
        >
          <Icon name="close" />
        </Button>
        {!isEditing && renderContextMenu()}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, threadId }): StateProps => {
    const noWebPage = selectNoWebPage(global, chatId, threadId);
    const {
      attachmentSettings,
    } = global;
    return {
      theme: selectTheme(global),
      webPagePreview: selectTabState(global).webPagePreview,
      noWebPage,
      attachmentSettings,
    };
  },
)(WebPagePreview));
