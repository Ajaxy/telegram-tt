import type { ApiPageBlock } from './instantView';

export interface ApiRichMessage {
  blocks: ApiPageBlock[];
  isRtl?: true;
  isPart?: true;
  partCutoff?: number;
}

export interface ApiInputRichMessage {
  blocks: ApiPageBlock[];
  isRtl?: true;
  shouldDisableAutoLink?: true;
}
