import {
  BlobSource, Input, MATROSKA, MP4, QTFF, WEBM,
} from 'mediabunny';

const INPUT_FORMATS = [MP4, QTFF, WEBM, MATROSKA];

export function createInput(file: Blob) {
  return new Input({ source: new BlobSource(file), formats: INPUT_FORMATS });
}

export async function getDecodableVideoTrack(input: Input) {
  const track = await input.getPrimaryVideoTrack();
  if (!track || !(await track.canDecode())) {
    throw new Error('decodeFailed');
  }

  return track;
}
