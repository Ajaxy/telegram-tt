import type { ApiSticker } from '../api/types';

export type MediaEditorAspectRatio =
  'free' | 'original' | 'square' | '3:2' | '2:3' | '4:3' | '3:4' | '5:4' | '4:5' | '7:5' | '5:7' | '16:9' | '9:16';

export interface CropState {
  cropperX: number;
  cropperY: number;
  cropperWidth: number;
  cropperHeight: number;
  aspectRatio: MediaEditorAspectRatio;
  rotation: number;
  quarterTurns: number;
  flipH: boolean;
}

export type DrawTool = 'pen' | 'arrow' | 'brush' | 'neon' | 'eraser';

export interface DrawAction {
  type: 'draw';
  tool: DrawTool;
  points: Array<{ x: number; y: number }>;
  color: string;
  brushSize: number;
  completedAt?: number;
  isShiftPressed?: boolean;
}

export type VideoTrim = {
  start: number;
  end: number;
};

export type VideoCoverSource = {
  type: 'frame';
  time: number;
} | {
  type: 'image';
  blobUrl: string;
};

export type AdjustmentKey = 'enhance' | 'exposure' | 'contrast' | 'saturation' | 'warmth' | 'fade'
  | 'highlights' | 'shadows' | 'vignette' | 'grain' | 'sharpen';

export type Adjustments = Partial<Record<AdjustmentKey, number>>;

export type TintState = {
  shadowsColor?: string;
  highlightsColor?: string;
};

export type CurveChannel = 'all' | 'red' | 'green' | 'blue';
export type CurveLevels = [number, number, number, number, number];
export type CurvesState = Partial<Record<CurveChannel, CurveLevels>>;

export type TextLayerFont = 'roboto' | 'suez' | 'fugaz' | 'courier' | 'chewy' | 'sedan' | 'bubbles' | 'playwrite';
export type TextLayerStyle = 'plain' | 'filled' | 'semi';
export type TextLayerAlign = 'left' | 'center' | 'right';

export type TextLayerContent = {
  value: string;
  font: TextLayerFont;
  style: TextLayerStyle;
  align: TextLayerAlign;
  color: string;
  size: number;
};

export type TextSettings = Omit<TextLayerContent, 'value'>;

export type DrawSettings = {
  tool: DrawTool;
  color: string;
  size: number;
};

export type MediaEditorSettings = {
  draw?: DrawSettings;
  text?: TextSettings;
};

export type EditorLayer = {
  id: string;
  type: 'text' | 'sticker';
  x: number;
  y: number;
  scale: number;
  rotation: number;
  text?: TextLayerContent;
  sticker?: ApiSticker;
};

export type MediaEditDocument = {
  crop: CropState;
  paint: DrawAction[];
  layers?: EditorLayer[];
  adjustments?: Adjustments;
  tint?: TintState;
  curves?: CurvesState;
  trim?: VideoTrim;
  cover?: VideoCoverSource;
  isMuted?: true;
  isGif?: true;
};

export type MediaEditState = {
  document: MediaEditDocument;
  undoStack: MediaEditDocument[];
  redoStack: MediaEditDocument[];
};

export type VideoQualityLevel = 240 | 360 | 480 | 600 | 720 | 1080;

export type VideoProcessingParams = {
  mode: 'remux' | 'transcode';
  sourceSize: { width: number; height: number };
  outputSize: { width: number; height: number };
  bitrate: number;
  frameRate?: number;
};
