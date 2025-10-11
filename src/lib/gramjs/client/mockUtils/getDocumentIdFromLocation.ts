import { toJSNumber } from '../../../../util/numbers';
import Api from '../../tl/api';

export default function getDocumentIdFromLocation(location: Api.TypeInputFileLocation): number {
  if (location instanceof Api.InputDocumentFileLocation) {
    return toJSNumber(location.id);
  }

  if (location instanceof Api.InputPhotoFileLocation) {
    return toJSNumber(location.id);
  }

  throw new Error(`Unsupported input file location type ${location.className}`);
}
