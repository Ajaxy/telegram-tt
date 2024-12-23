import type { Api as GramJs } from '../../../lib/gramjs';

type VirtualFields =
  'flags'
  | 'CONSTRUCTOR_ID'
  | 'SUBCLASS_OF_ID'
  | 'className'
  | 'classType'
  | 'getBytes';

export type OmitVirtualFields<T> = Omit<T, VirtualFields>;

export function bytesToDataUri(bytes: Buffer, shouldOmitPrefix = false, mimeType: string = 'image/jpeg') {
  const prefix = shouldOmitPrefix ? '' : `data:${mimeType};base64,`;

  return `${prefix}${btoa(String.fromCharCode(...bytes))}`;
}

export function omitVirtualClassFields<T extends GramJs.VirtualClass<T> & { flags?: any }>(
  instance: T,
): OmitVirtualFields<T> {
  const {
    flags,
    CONSTRUCTOR_ID,
    SUBCLASS_OF_ID,
    className,
    classType,
    getBytes,
    ...rest
  } = instance;

  return rest;
}
