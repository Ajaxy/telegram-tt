import { createElement, addEventListener } from './minifiers';
import { toggleText } from './toggleText';
import { throttle } from './utils';

export function createHeader(container, title, zoomOutLabel = 'Zoom out', zoomOutCallback) {
  let _element;
  let _titleElement;
  let _zoomOutElement;
  let _captionElement;
  let _isZooming;

  const setCaptionThrottled = throttle(setCaption, 100, false);

  _setupLayout();

  function setCaption(caption) {
    if (_isZooming) {
      return;
    }

    _captionElement.innerHTML = caption;
  }

  function zoom(caption) {
    _zoomOutElement = toggleText(_titleElement, zoomOutLabel, 'lovely-chart--header-title lovely-chart--header-zoom-out-control');
    setTimeout(() => {
      addEventListener(_zoomOutElement, 'click', _onZoomOut);
    }, 500);

    setCaption(caption);
  }

  function toggleIsZooming(isZooming) {
    _isZooming = isZooming;
  }

  function _setupLayout() {
    _element = createElement();
    _element.className = 'lovely-chart--header';

    _titleElement = createElement();
    _titleElement.className = 'lovely-chart--header-title';
    _titleElement.innerHTML = title;
    _element.appendChild(_titleElement);

    _captionElement = createElement();
    _captionElement.className = 'lovely-chart--header-caption lovely-chart--position-right';
    _element.appendChild(_captionElement);

    container.appendChild(_element);
  }

  function _onZoomOut() {
    _titleElement = toggleText(_zoomOutElement, title, 'lovely-chart--header-title', true);
    _titleElement.classList.remove('lovely-chart--transition');

    zoomOutCallback();
  }

  return {
    setCaption: setCaptionThrottled,
    zoom,
    toggleIsZooming,
  };
}
