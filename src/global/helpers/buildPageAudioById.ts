import type {
  ApiAudio,
  ApiInstantViewPage,
  ApiPageBlock,
  ApiPageBlockAudio,
  ApiPageBlockDocument,
  ApiPageBlockPhoto,
  ApiPageBlockVideo,
} from '../../api/types';

import { buildCollectionByKey } from '../../util/iteratees';

export type PageBlockWithMedia = ApiPageBlockPhoto | ApiPageBlockVideo | ApiPageBlockAudio | ApiPageBlockDocument;

export function getPageBlocksWithMedia(blocks: ApiPageBlock[]): PageBlockWithMedia[] {
  return blocks.flatMap((block) => {
    switch (block.type) {
      case 'photo':
      case 'video':
      case 'audio':
      case 'document':
        return [block];
      case 'cover':
        return getPageBlocksWithMedia([block.cover]);
      case 'collage':
      case 'slideshow':
        return getPageBlocksWithMedia(block.items);
      case 'list':
      case 'orderedList':
        return block.items.flatMap((item) => (item.type === 'blocks' ? getPageBlocksWithMedia(item.blocks) : []));
      default:
        return 'blocks' in block ? getPageBlocksWithMedia(block.blocks) : [];
    }
  });
}

export function getPageBlocksAudios(blocks: ApiPageBlock[]): ApiAudio[] {
  return getPageBlocksWithMedia(blocks).flatMap((block) => (block.type === 'audio' ? [block.audio] : []));
}

export function buildPageAudioById(page: ApiInstantViewPage): Record<string, ApiAudio> | undefined {
  const audios = getPageBlocksAudios(page.blocks);

  return audios.length ? buildCollectionByKey(audios, 'id') : undefined;
}
