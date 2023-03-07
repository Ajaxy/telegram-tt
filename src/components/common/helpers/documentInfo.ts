import type { ApiDocument } from '../../../api/types';

const ONE_GIGABYTE = 1024 * 1024 * 1024;
const ONE_MEGABYTE = 1024 * 1024;

export function getFileSizeString(bytes: number) {
  if (bytes > (ONE_GIGABYTE / 2)) {
    return `${(bytes / ONE_GIGABYTE).toFixed(1)} GB`;
  }
  if (bytes > (ONE_MEGABYTE / 2)) {
    return `${(bytes / ONE_MEGABYTE).toFixed(1)} MB`;
  }
  return `${(bytes / (1024)).toFixed(1)} KB`;
}

export function getDocumentExtension(document: ApiDocument) {
  const { fileName, mimeType } = document;

  return getFileExtension(fileName, mimeType);
}

export function getFileExtension(fileName: string, mimeType: string) {
  if (fileName && fileName.indexOf('.') !== -1) {
    return fileName.split('.').pop();
  } else {
    return mimeType.split('/').pop();
  }
}

export function getColorFromExtension(extension: string) {
  switch (extension) {
    case 'apk':
    case 'xls':
    case 'xlsx':
    case 'ods':
      return 'green';
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
    case 'bz2':
    case 'liz':
    case 'lz4':
    case 'lz5':
    case 'xz':
    case 'zst':
    case 'wim':
    case 'ppt':
    case 'pptx':
    case 'odp':
      return 'orange';
    case 'pdf':
    case 'xps':
      return 'red';
    default:
      return 'default';
  }
}

export function getDocumentHasPreview(document: ApiDocument) {
  return Boolean(document.previewBlobUrl || document.thumbnail);
}
