import type { TeactNode } from '@teact';

import type { IconName } from '../../../types/icons';
import type {
  DrawSettings, MediaEditDocument, TextSettings, VideoQualityLevel,
} from '../../../types/mediaEditor';
import type { Size } from './render/transform';

export type VideoAudioHandling = 'none' | 'copy' | 'transcode' | 'unsupported';

export type AvatarShape = 'circle' | 'roundedSquare';

export type VideoProbe = {
  width: number;
  height: number;
  duration: number;
  frameRate: number;
  videoBitrate: number;
  audioBitrate?: number;
  canDecodeVideo: boolean;
  audioHandling: VideoAudioHandling;
};

export type VideoQualityControl = {
  levels: VideoQualityLevel[];
  level?: VideoQualityLevel;
  originalLevel: number;
  outputSize: Size;
  estimatedSize: number;
  isGif?: boolean;
  onChange: (level?: VideoQualityLevel) => void;
};

export type EditorPanelProps = {
  doc: MediaEditDocument;
  sourceSize?: Size;
  drawSettings: DrawSettings;
  videoQuality?: VideoQualityControl;
  isActive?: boolean;
  isVideo?: boolean;
  canAdjustColors?: boolean;
  isAspectRatioLocked?: boolean;
  isAvatar?: boolean;
  chatId?: string;
  textSettings: TextSettings;
  getDoc: () => MediaEditDocument;
  onTextSettingsChange: (settings: TextSettings, isPreview?: boolean) => void;
  onPreview: (doc: MediaEditDocument) => void;
  onCommit: (doc: MediaEditDocument) => void;
  onDrawSettingsChange: (settings: DrawSettings, isPreview?: boolean) => void;
};

export type EditorTabId = 'adjust' | 'crop' | 'text' | 'draw' | 'stickers';

export type EditorTabContext = {
  isVideo: boolean;
  canProcessVideo: boolean;
  canAddStickers: boolean;
};

export type EditorTabDescriptor = {
  id: EditorTabId;
  icon: IconName;
  labelKey: 'Adjust' | 'Crop' | 'Text' | 'Draw' | 'Stickers';
  isCropMode?: true;
  isAvailable?: (context: EditorTabContext) => boolean;
  Panel: (props: EditorPanelProps) => TeactNode;
};
