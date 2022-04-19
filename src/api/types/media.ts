// We cache avatars as Data URI for faster initial load
// and messages media as Blob for smaller size.

export enum ApiMediaFormat {
  BlobUrl,
  Lottie,
  Progressive,
  Stream,
  Text,
}

export type ApiParsedMedia = string | Blob | ArrayBuffer;
export type ApiPreparedMedia = string;
