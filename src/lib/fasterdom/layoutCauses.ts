// https://gist.github.com/paulirish/5d52fb081b3570c81e3a

export default {
  Element: {
    props: [
      'clientLeft', 'clientTop', 'clientWidth', 'clientHeight',
      'scrollWidth', 'scrollHeight', 'scrollLeft', 'scrollTop',
    ] as const,
    methods: [
      'getClientRects', 'getBoundingClientRect',
      'scrollBy', 'scrollTo', 'scrollIntoView', 'scrollIntoViewIfNeeded',
    ] as const,
  },
  HTMLElement: {
    props: [
      'offsetLeft', 'offsetTop', 'offsetWidth', 'offsetHeight', 'offsetParent',
      'innerText',
    ] as const,
    methods: ['focus'] as const,
  },
  window: {
    props: [
      'scrollX', 'scrollY',
      'innerHeight', 'innerWidth',
    ] as const,
    methods: ['getComputedStyle'] as const,
  },
  VisualViewport: {
    props: [
      'height', 'width', 'offsetTop', 'offsetLeft',
    ] as const,
  },
  Document: {
    props: ['scrollingElement'] as const,
    methods: ['elementFromPoint'] as const,
  },
  HTMLInputElement: {
    methods: ['select'] as const,
  },
  MouseEvent: {
    props: ['layerX', 'layerY', 'offsetX', 'offsetY'] as const,
  },
  Range: {
    methods: ['getClientRects', 'getBoundingClientRect'] as const,
  },
};
