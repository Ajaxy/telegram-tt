import type {
  ApiPageBlock,
  ApiPageBlockPhoto,
  ApiPageBlockVideo,
  ApiPhoto,
  ApiVideo,
} from '../../../api/types';

export type PageMediaBlock = ApiPageBlockPhoto | ApiPageBlockVideo;

export function getPageMediaBlocks(blocks: ApiPageBlock[]) {
  const mediaBlocks: PageMediaBlock[] = [];

  blocks.forEach((block) => {
    if (isPageMediaBlock(block)) {
      mediaBlocks.push(block);
    }
  });

  return mediaBlocks;
}

export function isPageMediaBlock(block: ApiPageBlock): block is PageMediaBlock {
  return block.type === 'photo' || block.type === 'video';
}

export function getPageMediaBlockMedia(block: ApiPageBlockPhoto): ApiPhoto;
export function getPageMediaBlockMedia(block: ApiPageBlockVideo): ApiVideo;
export function getPageMediaBlockMedia(block: PageMediaBlock): ApiPhoto | ApiVideo;
export function getPageMediaBlockMedia(block: PageMediaBlock) {
  if (block.type === 'photo') {
    if (!block.isSpoiler) {
      return block.photo;
    }

    return {
      ...block.photo,
      isSpoiler: true,
    };
  }

  if (!block.isSpoiler) {
    return block.video;
  }

  return {
    ...block.video,
    isSpoiler: true,
  };
}

export function getPageMediaBlockId(block: PageMediaBlock) {
  return block.type === 'photo' ? block.photo.id : block.video.id;
}

export function getPageMediaSourceId(containerId: string, sourceKey: string, block: PageMediaBlock) {
  return `${containerId}-page-media-${sourceKey}-${getPageMediaBlockId(block)}`;
}

export function getPageMediaSourceIds(containerId: string, sourceKey: string, blocks: PageMediaBlock[]) {
  return blocks.map((block, index) => getPageMediaSourceId(containerId, `${sourceKey}-${index}`, block));
}
