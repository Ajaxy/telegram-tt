import { memo, useEffect, useRef } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiWebPage,
  ApiWebPageFull,
  ApiWebPagePending,
} from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { ThreadId, WebPageMediaSize } from '../../../types';

import {
  getMediaHash,
  getWebPageAudio,
  getWebPageDocument,
  getWebPagePhoto,
  getWebPageVideo,
} from '../../../global/helpers';
import { selectNoWebPage, selectTabState, selectWebPage } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useThumbnail from '../../../hooks/media/useThumbnail';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useDerivedState from '../../../hooks/useDerivedState';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useShowTransition from '../../../hooks/useShowTransition';

import Icon from '../../common/icons/Icon';
import PeerColorWrapper from '../../common/PeerColorWrapper';
import Button from '../../ui/Button';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';

import styles from './WebPagePreview.module.scss';

type OwnProps = {
  chatId: string;
  threadId: ThreadId;
  isEditing: boolean;
  isDisabled?: boolean;
};

type StateProps = {
  webPagePreview?: ApiWebPageFull | ApiWebPagePending;
  noWebPage?: boolean;
  attachmentSettings: GlobalState['attachmentSettings'];
};

const WebPagePreview = ({
  chatId,
  threadId,
  isDisabled,
  webPagePreview,
  noWebPage,
  attachmentSettings,
  isEditing,
}: OwnProps & StateProps) => {
  const {
    toggleMessageWebPage,
    updateAttachmentSettings,
  } = getActions();

  const lang = useLang();

  const ref = useRef<HTMLDivElement>();

  const isInvertedMedia = attachmentSettings.isInvertedMedia;
  const isSmallerMedia = attachmentSettings.webPageMediaSize === 'small';

  const isShown = useDerivedState(() => {
    return Boolean(webPagePreview && !noWebPage && !isDisabled);
  }, [isDisabled, noWebPage, webPagePreview]);
  const { shouldRender } = useShowTransition({ isOpen: isShown, ref, withShouldRender: true });

  const hasMediaSizeOptions = webPagePreview?.webpageType === 'full' && webPagePreview.hasLargeMedia;

  const prevWebPageRef = useRef<ApiWebPage | undefined>(webPagePreview);

  if (webPagePreview && webPagePreview !== prevWebPageRef.current) {
    prevWebPageRef.current = webPagePreview;
  }

  const renderingWebPage = webPagePreview || prevWebPageRef.current;

  const isFullWebPage = renderingWebPage?.webpageType === 'full';

  const thumbnailUrl = useThumbnail(isFullWebPage ? { content: renderingWebPage } : undefined);
  const previewMedia = getWebPagePhoto(renderingWebPage) || getWebPageVideo(renderingWebPage)
    || getWebPageAudio(renderingWebPage) || getWebPageDocument(renderingWebPage);
  const previewMediaHash = previewMedia && getMediaHash(previewMedia, 'pictogram');
  const previewMediaUrl = useMedia(previewMediaHash);

  const { shouldRender: shouldRenderPreviewMedia, ref: previewMediaRef } = useShowTransition<HTMLImageElement>({
    isOpen: Boolean(previewMediaUrl),
    withShouldRender: true,
    noCloseTransition: true,
  });

  const hasPreviewMedia = Boolean(previewMediaUrl || shouldRenderPreviewMedia);

  const handleClearWebpagePreview = useLastCallback(() => {
    toggleMessageWebPage({ chatId, threadId, noWebPage: true });
  });

  const {
    isContextMenuOpen, contextMenuAnchor, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide, handleBeforeContextMenu,
  } = useContextMenuHandlers(ref, isEditing, true);

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => ref.current!);
  const getMenuElement = useLastCallback(
    () => ref.current!.querySelector(`.${styles.contextMenu} .bubble`),
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

  function renderContextMenu() {
    return (
      <Menu
        isOpen={isContextMenuOpen}
        anchor={contextMenuAnchor}
        getTriggerElement={getTriggerElement}
        getRootElement={getRootElement}
        getMenuElement={getMenuElement}
        className={styles.contextMenu}
        onClose={handleContextMenuClose}
        onCloseAnimationEnd={handleContextMenuHide}
        autoClose
      >
        <>
          {
            isInvertedMedia ? (
              <MenuItem icon="move-caption-up" onClick={() => updateIsInvertedMedia(undefined)}>
                {lang('ContextMoveTextUp')}
              </MenuItem>
            ) : (
              <MenuItem icon="move-caption-down" onClick={() => updateIsInvertedMedia(true)}>
                {lang('ContextMoveTextDown')}
              </MenuItem>
            )
          }
          {hasMediaSizeOptions && (
            isSmallerMedia ? (
              <MenuItem icon="expand" onClick={() => updateIsLargerMedia('large')}>
                {lang('ContextLinkLargerMedia')}
              </MenuItem>
            ) : (
              <MenuItem icon="collapse" onClick={() => updateIsLargerMedia('small')}>
                {lang('ContextLinkSmallerMedia')}
              </MenuItem>
            )
          )}
          <MenuItem
            icon="delete"
            onClick={handleClearWebpagePreview}
          >
            {lang('ContextLinkRemovePreview')}
          </MenuItem>
        </>
      </Menu>
    );
  }

  return (
    <div
      className={buildClassName(
        styles.root,
        !isEditing && styles.interactive,
      )}
      ref={ref}
    >
      <div className={styles.inner}>
        <div className={styles.leftIcon} onClick={handlePreviewClick}>
          <Icon name="link" />
        </div>
        {renderingWebPage && renderingWebPage.webpageType !== 'empty' && (
          <PeerColorWrapper
            noUserColors
            className={styles.preview}
            onContextMenu={handleContextMenu}
            onMouseDown={handleBeforeContextMenu}
            onClick={handlePreviewClick}
          >
            {hasPreviewMedia && (
              <div className={styles.previewImageContainer}>
                {thumbnailUrl && (
                  <img src={thumbnailUrl} alt="" className={styles.previewImage} />
                )}
                {shouldRenderPreviewMedia && (
                  <img ref={previewMediaRef} src={previewMediaUrl} alt="" className={styles.previewImage} />
                )}
              </div>
            )}
            <div className={styles.previewText}>
              <span className={styles.siteName}>
                {isFullWebPage
                  ? (renderingWebPage.siteName || renderingWebPage.url)
                  : lang('Loading')}
              </span>
              <span className={styles.siteDescription}>
                {isFullWebPage
                  ? (renderingWebPage.description || lang(getMediaTypeKey(renderingWebPage)))
                  : renderingWebPage.url}
              </span>
            </div>
          </PeerColorWrapper>
        )}
        <Button
          className={styles.clear}
          round
          faded
          color="translucent"
          ariaLabel={lang('AccLinkRemovePreview')}
          onClick={handleClearWebpagePreview}
          iconName="close"
        />
        {!isEditing && renderContextMenu()}
      </div>
    </div>
  );
};

function getMediaTypeKey(webPage: ApiWebPageFull) {
  if (webPage.photo) return 'AttachPhoto';
  if (webPage.video) return 'AttachVideo';
  if (webPage.audio) return 'AttachMusic';
  if (webPage.document) return 'AttachDocument';
  if (webPage.story) return 'AttachStory';
  return 'LinkPreview';
}

export default memo(withGlobal<OwnProps>(
  (global, { chatId, threadId }): Complete<StateProps> => {
    const tabState = selectTabState(global);
    const noWebPage = selectNoWebPage(global, chatId, threadId);
    const {
      attachmentSettings,
    } = global;

    const webPagePreview = tabState.webPagePreviewId ? selectWebPage(global, tabState.webPagePreviewId) : undefined;

    return {
      webPagePreview: webPagePreview?.webpageType === 'empty' ? undefined : webPagePreview,
      noWebPage,
      attachmentSettings,
    };
  },
)(WebPagePreview));
