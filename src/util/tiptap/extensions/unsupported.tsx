import { Node } from '@tiptap/core';

import { getTranslationFn } from '../../localization';
import { UNSUPPORTED_NODE_NAME } from '../constants';

import useLang from '../../../hooks/useLang';

import UnsupportedPlate from '../../../components/common/UnsupportedPlate';
import TeactNodeViewRenderer from '../TeactNodeViewRenderer';

import styles from '../styling.module.scss';

export const UnsupportedNode = Node.create({
  name: UNSUPPORTED_NODE_NAME,
  group: 'block',
  atom: true,

  parseHTML() {
    return [{ tag: `div[data-rich-text-type="${UNSUPPORTED_NODE_NAME}"]` }];
  },

  renderHTML() {
    return ['div', {
      contenteditable: 'false',
      'data-rich-text-type': UNSUPPORTED_NODE_NAME,
    }, getTranslationFn()('PageContentUnsupported')];
  },

  addNodeView() {
    return TeactNodeViewRenderer(UnsupportedView, { className: styles.unsupportedNode });
  },
});

function UnsupportedView() {
  const lang = useLang();

  return <UnsupportedPlate title={lang('UnsupportedBlockTitle')} text={lang('UnsupportedBlockMessage')} />;
}
