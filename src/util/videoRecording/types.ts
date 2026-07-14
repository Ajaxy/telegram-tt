export type Result = {
  blob: Blob;
  duration: number;
  durationMs: number;
  width: number;
  height: number;
};

export type ActiveVideoRecording = {
  stop: () => Promise<Result>;
  cancel: () => void;
  previewStream: MediaStream;
};

export type VideoRecorderEngine = {
  finalize: () => Promise<Blob>;
  cancel: () => void;
};
