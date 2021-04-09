import { ApiFormattedText } from '../../../../api/types';
import { renderTextWithEntities } from '../../../common/helpers/renderMessageText';

export default function getMessageTextAsHtml(formattedText?: ApiFormattedText) {
  const { text, entities } = formattedText || {};
  if (!text) {
    return '';
  }

  const result = renderTextWithEntities(
    text,
    entities,
    undefined,
    undefined,
    true,
  );

  if (Array.isArray(result)) {
    return result.join('');
  }

  return result;
}
