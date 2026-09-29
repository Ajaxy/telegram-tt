import { Node as TiptapNode } from '@tiptap/core';
import {
  useEffect, useRef, useState,
} from '../../../../lib/teact/teact';

import type { ApiPageBlockPhoto, ApiPageBlockVideo } from '../../../../api/types';
import type { IAnchorPosition } from '../../../../types';
import type { TeactNodeViewComponentProps } from '../../../../util/tiptap';
import type {
  RichEditorMediaItem,
} from '../../../../util/tiptap/richMedia';
import type { RichEditorMediaEditHandler, RichEditorMediaFilesHandler } from '../richEditorTypes';

import { getRichTextPlainText } from '../../../../global/helpers/richMessage';
import { selectTheme } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { openSystemFilesDialog } from '../../../../util/systemFilesDialog';
import { NodeViewContent, TeactNodeViewRenderer } from '../../../../util/tiptap';
import { MEDIA_NODE_NAME } from '../../../../util/tiptap/constants';
import {
  buildRichMediaItemBlock,
  cancelRichMediaUpload,
  getRichEditorMediaAttrs,
  getRichMediaRef,
  getRichMediaUpload,
  resolveRichEditorMediaAttrs,
  RICH_MEDIA_CONTENT_TYPES,
  subscribeToRichMediaUpload,
} from '../../../../util/tiptap/richMedia';
import tiptapStyles from '../../../../util/tiptap/styling.module.scss';

import useSelector from '../../../../hooks/data/useSelector';
import useFlag from '../../../../hooks/useFlag';
import useForceUpdate from '../../../../hooks/useForceUpdate';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import AttachmentAudio from '../../../common/AttachmentAudio';
import Document from '../../../common/Document';
import Collage from '../../../iv/Collage';
import Slideshow from '../../../iv/Slideshow';
import Button from '../../../ui/Button';
import Menu from '../../../ui/Menu';
import MenuItem from '../../../ui/MenuItem';

import styles from './EditableMedia.module.scss';

type MediaViewItem = {
  item: RichEditorMediaItem;
  index: number;
  block: ApiPageBlockPhoto | ApiPageBlockVideo;
};

const MEDIA_FILE_TYPES = Array.from(RICH_MEDIA_CONTENT_TYPES).join(',');
const EMPTY_MEDIA_ITEMS: RichEditorMediaItem[] = [];

export function buildRichEditorMedia(
  onMediaEdit: RichEditorMediaEditHandler,
  onMediaFiles: RichEditorMediaFilesHandler,
) {
  return TiptapNode.create({
    name: MEDIA_NODE_NAME,
    group: 'block',
    content: 'inline*',
    defining: true,
    isolating: true,
    draggable: false,
    selectable: true,

    addAttributes() {
      return {
        kind: { default: 'photo' },
        items: { default: [] },
        credit: { default: { type: 'empty' } },
      };
    },

    parseHTML() {
      return [{
        tag: '[data-rich-editor-media]',
        getAttrs: (element) => parseMediaElementAttrs(element),
      }];
    },

    renderHTML() {
      return [
        'figure',
        { 'data-rich-editor-media': '' },
        ['figcaption', 0],
      ];
    },

    renderText({ node }) {
      const attrs = getRichEditorMediaAttrs(node.toJSON());
      const caption = [node.textContent, attrs && getRichTextPlainText(attrs.credit)].filter(Boolean).join('\n');
      if (caption) return caption;

      return attrs?.items.flatMap((item) => (
        item.media ? [getRichMediaRef(item.type, item.media.id!)] : []
      )).join('\n') || '';
    },

    addNodeView() {
      return TeactNodeViewRenderer(EditableMedia, {
        as: 'figure',
        contentDOMElementTag: 'div',
      });
    },

    addOptions() {
      return { onMediaEdit, onMediaFiles };
    },
  });
}

const EditableMedia = ({
  editor,
  node,
  selected,
  getPos,
  updateAttributes,
  deleteNode,
  extension,
}: TeactNodeViewComponentProps) => {
  const menuTriggerRef = useRef<HTMLButtonElement>();
  const menuRef = useRef<HTMLDivElement>();
  const [isMenuOpen, openMenu, closeMenu] = useFlag();
  const [menuAnchor, setMenuAnchor] = useState<IAnchorPosition | undefined>();
  const [menuItemIndex, setMenuItemIndex] = useState(0);
  const forceUpdate = useForceUpdate();
  const lang = useLang();
  const theme = useSelector(selectTheme);
  const attrs = getRichEditorMediaAttrs(node.toJSON());
  const items = attrs?.items || EMPTY_MEDIA_ITEMS;
  const isStandalone = attrs?.kind === 'document' || attrs?.kind === 'audio';
  const standaloneUpload = isStandalone ? getRichMediaUpload(items[0]?.uploadId) : undefined;
  const standaloneMedia = isStandalone ? items[0]?.media || standaloneUpload?.preview : undefined;
  const isStandaloneUploading = standaloneUpload?.status === 'preparing' || standaloneUpload?.status === 'pending';
  const standaloneUploadProgress = isStandaloneUploading ? standaloneUpload.progress : undefined;
  const viewItems = buildMediaViewItems(items);
  const mediaBlocks = viewItems.map(({ block }) => block);
  const sourceIds = viewItems.map(({ item }, index) => item.uploadId || item.media?.id || String(index));
  const isCaptionEmpty = node.content.size === 0;
  const uploadIdsKey = items.flatMap(({ uploadId }) => uploadId ? [uploadId] : []).join(',');

  useEffect(() => {
    const unsubscribers = uploadIdsKey
      ? uploadIdsKey.split(',').map((uploadId) => subscribeToRichMediaUpload(uploadId, forceUpdate))
      : [];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [uploadIdsKey, forceUpdate]);

  const handleRootMouseDown = useLastCallback((e: React.MouseEvent<HTMLElement>) => {
    const position = getPos();
    if (typeof position !== 'number') return;

    if ((e.target as HTMLElement).closest('button, [data-node-view-content]')) return;
    e.preventDefault();
    editor.commands.setNodeSelection(position);
  });

  const handleAdd = useLastCallback((e: React.SyntheticEvent<HTMLElement>) => {
    e.preventDefault();
    const position = getPos();
    if (typeof position !== 'number') return;

    openSystemFilesDialog(MEDIA_FILE_TYPES, (event) => {
      const files = Array.from((event.target as HTMLInputElement).files || []);
      if (files.length) {
        (extension.options.onMediaFiles as RichEditorMediaFilesHandler)(files, position, true);
      }
    });
  });

  const handleToggleLayout = useLastCallback((e: React.SyntheticEvent<HTMLElement>) => {
    e.preventDefault();
    if (!attrs || attrs.items.length < 2) return;

    updateAttributes({
      kind: attrs.kind === 'slideshow' ? 'collage' : 'slideshow',
    });
  });

  const handleDeleteItem = useLastCallback((index: number) => {
    const currentAttrs = getRichEditorMediaAttrs(node.toJSON());
    if (!currentAttrs) return;

    const uploadId = currentAttrs.items[index]?.uploadId;
    if (uploadId) cancelRichMediaUpload(uploadId);

    const nextItems = currentAttrs.items.filter((_item, itemIndex) => itemIndex !== index);
    if (!nextItems.length) {
      deleteNode();
      return;
    }

    updateAttributes({
      items: nextItems,
      kind: nextItems.length === 1 ? nextItems[0].type : currentAttrs.kind,
    });
  });

  const handleCancelUpload = useLastCallback((index: number) => {
    const viewItem = viewItems[index];
    if (!viewItem) return;

    const upload = getRichMediaUpload(viewItem.item.uploadId);
    if (!upload || (upload.status !== 'preparing' && upload.status !== 'pending')) return;

    if (upload.cancelReplacement) {
      upload.cancelReplacement();
      return;
    }

    handleDeleteItem(viewItem.index);
  });

  const handleToggleSpoiler = useLastCallback((index: number) => {
    const currentAttrs = getRichEditorMediaAttrs(node.toJSON());
    if (!currentAttrs?.items[index]) return;

    const nextItems = currentAttrs.items.slice();
    const currentItem = nextItems[index];
    nextItems[index] = {
      ...currentItem,
      isSpoiler: currentItem.isSpoiler ? undefined : true,
    };
    updateAttributes({ items: nextItems });
  });

  const handleMenuTriggerClick = useLastCallback((e: React.MouseEvent<HTMLButtonElement>, index: number) => {
    preventDefault(e);
    selectMedia();

    const trigger = e.currentTarget;
    const rect = trigger.getBoundingClientRect();
    menuTriggerRef.current = trigger;
    setMenuItemIndex(index);
    setMenuAnchor({
      x: rect.left,
      y: rect.bottom,
      width: rect.width,
      height: rect.height,
    });
    openMenu();
  });

  const handleRetryUpload = useLastCallback(() => {
    getRichMediaUpload(items[menuItemIndex]?.uploadId)?.retry();
  });

  const handleEditMenuItem = useLastCallback(() => {
    const uploadId = items[menuItemIndex]?.uploadId;
    if (uploadId) {
      (extension.options.onMediaEdit as RichEditorMediaEditHandler)(uploadId);
    }
  });

  const handleToggleMenuItemSpoiler = useLastCallback(() => {
    handleToggleSpoiler(menuItemIndex);
  });

  const handleDeleteMenuItem = useLastCallback(() => {
    handleDeleteItem(menuItemIndex);
  });

  const handleCancelStandaloneUpload = useLastCallback(() => {
    handleDeleteItem(0);
  });

  const getMenuTriggerElement = useLastCallback(() => menuTriggerRef.current);
  const getMenuRootElement = useLastCallback(() => document.body);
  const getMenuElement = useLastCallback(() => menuRef.current);
  const getMenuLayout = useLastCallback(() => ({ withPortal: true }));
  const menuItem = items[menuItemIndex];
  const menuItemUpload = getRichMediaUpload(menuItem?.uploadId);
  const canEditMenuItem = Boolean(
    menuItem?.type === 'photo' && menuItemUpload?.attachment.blob && !menuItemUpload.cancelReplacement,
  );

  const getUploadProgress = useLastCallback((_block: ApiPageBlockPhoto | ApiPageBlockVideo, index: number) => {
    const uploadId = viewItems[index]?.item.uploadId;
    const upload = getRichMediaUpload(uploadId);
    return upload?.status === 'preparing' || upload?.status === 'pending' ? upload.progress : undefined;
  });

  const renderOverlay = useLastCallback((_block: ApiPageBlockPhoto | ApiPageBlockVideo, index: number) => {
    const viewItem = viewItems[index];
    if (!viewItem) return undefined;

    const upload = getRichMediaUpload(viewItem.item.uploadId);

    return (
      <div className={styles.itemActions} contentEditable={false}>
        {upload?.status === 'failed' && <span className={styles.failedLabel}>{lang('RichMediaUploadFailed')}</span>}
        <Button
          round
          size="tiny"
          color="translucent-white"
          className={styles.menuButton}
          iconName="more"
          ariaLabel={lang('AccDescrMoreOptions')}
          hasPopup
          onMouseDown={preventDefault}
          onClick={(e) => handleMenuTriggerClick(e, viewItem.index)}
        />
      </div>
    );
  });

  if (!attrs || (!viewItems.length && !standaloneMedia)) {
    return undefined;
  }

  return (
    <div
      className={buildClassName(styles.root, selected && styles.selected)}
      onMouseDown={handleRootMouseDown}
    >
      {standaloneMedia ? (
        <div className={styles.standaloneRow} contentEditable={false}>
          {standaloneMedia.mediaType === 'document' && (
            <Document
              className={styles.standaloneMedia}
              document={standaloneMedia}
              uploadProgress={standaloneUploadProgress}
              noDownload
              onCancelUpload={handleCancelStandaloneUpload}
            />
          )}
          {standaloneMedia.mediaType === 'audio' && (
            <AttachmentAudio
              className={styles.standaloneMedia}
              attachment={standaloneUpload?.attachment}
              audio={standaloneMedia}
              uploadProgress={standaloneUploadProgress}
              onCancelUpload={handleCancelStandaloneUpload}
            />
          )}
          <Button
            round
            size="tiny"
            color="translucent"
            iconName="more"
            ariaLabel={lang('AccDescrMoreOptions')}
            hasPopup
            onMouseDown={preventDefault}
            onClick={(e) => handleMenuTriggerClick(e, 0)}
          />
          {standaloneUpload?.status === 'failed' && (
            <span className={styles.uploadError}>{lang('RichMediaUploadFailed')}</span>
          )}
        </div>
      ) : (
        <div className={styles.media} contentEditable={false}>
          {attrs.kind === 'slideshow' && mediaBlocks.length > 1 ? (
            <Slideshow
              items={mediaBlocks}
              sourceIds={sourceIds}
              theme={theme}
              canAutoLoadMedia
              noSpoilerReveal
              getUploadProgress={getUploadProgress}
              renderCaption={renderNothing}
              renderOverlay={renderOverlay}
              onCancelUpload={handleCancelUpload}
              onMediaClick={selectMedia}
            />
          ) : (
            <Collage
              items={mediaBlocks}
              sourceIds={sourceIds}
              theme={theme}
              canAutoLoadMedia
              noSpoilerReveal
              getUploadProgress={getUploadProgress}
              renderOverlay={renderOverlay}
              onCancelUpload={handleCancelUpload}
              onMediaClick={selectMedia}
            />
          )}
        </div>
      )}
      {selected && !isStandalone && (
        <div className={styles.groupToolbar} contentEditable={false}>
          {items.length > 1 && (
            <Button
              round
              size="tiny"
              color="translucent-black"
              className={styles.groupButton}
              iconClassName={styles.groupButtonIcon}
              iconName={attrs.kind === 'slideshow' ? 'collage' : 'carousel'}
              ariaLabel={lang(attrs.kind === 'slideshow' ? 'RichMediaCollage' : 'RichMediaSlideshow')}
              onMouseDown={preventDefault}
              onClick={handleToggleLayout}
            />
          )}
          <Button
            round
            size="tiny"
            color="translucent-black"
            className={styles.groupButton}
            iconClassName={styles.groupButtonIcon}
            iconName="media-add"
            ariaLabel={lang('Add')}
            onMouseDown={preventDefault}
            onClick={handleAdd}
          />
        </div>
      )}
      <NodeViewContent
        className={buildClassName(styles.caption, isCaptionEmpty && tiptapStyles.emptyBlock)}
        placeholder={isCaptionEmpty ? lang('AttachmentCaptionPlaceholder') : undefined}
      />
      {attrs.credit.type !== 'empty' && (
        <div className={styles.credit} contentEditable={false}>{getRichTextPlainText(attrs.credit)}</div>
      )}
      <Menu
        ref={menuRef}
        isOpen={isMenuOpen && Boolean(items[menuItemIndex])}
        anchor={menuAnchor}
        ariaLabel={lang('AccDescrMoreOptions')}
        getTriggerElement={getMenuTriggerElement}
        getRootElement={getMenuRootElement}
        getMenuElement={getMenuElement}
        getLayout={getMenuLayout}
        autoClose
        withPortal
        onClose={closeMenu}
      >
        {(menuItemUpload?.status === 'failed' || menuItemUpload?.status === 'canceled') && (
          <MenuItem icon="reload" withPreventDefaultOnMouseDown onClick={handleRetryUpload}>
            {lang('RichMediaRetry')}
          </MenuItem>
        )}
        {canEditMenuItem && (
          <MenuItem icon="edit" withPreventDefaultOnMouseDown onClick={handleEditMenuItem}>
            {lang('EditMedia')}
          </MenuItem>
        )}
        {!isStandalone && (
          <MenuItem
            icon={menuItem?.isSpoiler ? 'spoiler-disable' : 'spoiler'}
            withPreventDefaultOnMouseDown
            onClick={handleToggleMenuItemSpoiler}
          >
            {lang(menuItem?.isSpoiler
              ? 'AttachmentMenuDisableSpoiler' : 'AttachmentMenuEnableSpoiler')}
          </MenuItem>
        )}
        <MenuItem
          destructive
          icon="delete"
          withPreventDefaultOnMouseDown
          onClick={handleDeleteMenuItem}
        >
          {lang('Delete')}
        </MenuItem>
      </Menu>
    </div>
  );

  function selectMedia() {
    const position = getPos();
    if (typeof position === 'number') editor.commands.setNodeSelection(position);
  }
};

function buildMediaViewItems(items: RichEditorMediaItem[]) {
  return items.flatMap((item, index): MediaViewItem[] => {
    const media = item.media || getRichMediaUpload(item.uploadId)?.preview;
    const block = buildRichMediaItemBlock(item, media);
    return block && (block.type === 'photo' || block.type === 'video') ? [{ item, index, block }] : [];
  });
}

function parseMediaElementAttrs(element: HTMLElement) {
  return resolveRichEditorMediaAttrs(element.dataset.richEditorMediaId) || false;
}

function preventDefault(e: React.MouseEvent<HTMLElement>) {
  e.preventDefault();
  e.stopPropagation();
}

function renderNothing() {
  return undefined;
}

export default EditableMedia;
