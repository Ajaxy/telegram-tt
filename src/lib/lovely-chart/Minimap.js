import { setupCanvas, clearCanvas } from './canvas.js';
import { preparePoints } from './preparePoints.js';
import { createProjection } from './Projection.js';
import { drawDatasets } from './drawDatasets.js';
import { captureEvents } from './captureEvents.js';
import {
  DEFAULT_RANGE,
  MINIMAP_HEIGHT,
  MINIMAP_EAR_WIDTH,
  MINIMAP_MARGIN,
  MINIMAP_LINE_WIDTH,
  MINIMAP_MAX_ANIMATED_DATASETS,
  SIMPLIFIER_MINIMAP_FACTOR,
} from './constants.js';
import { proxyMerge, throttleWithRaf } from './utils.js';
import { createElement } from './minifiers.js';
import { getSimplificationDelta } from './formulas.js';

export function createMinimap(container, data, colors, rangeCallback) {
  let _element;
  let _canvas;
  let _context;
  let _canvasSize;
  let _ruler;
  let _slider;
  let _limitMask;

  let _capturedOffset;
  let _range = {};
  let _state;

  const _limitBegin = data.limitBegin;

  const _updateRulerOnRaf = throttleWithRaf(_updateRuler);

  _setupLayout();
  _updateRange(data.minimapRange || DEFAULT_RANGE);

  function update(newState) {
    const { begin, end } = newState;
    if (!_capturedOffset) {
      _updateRange({ begin, end }, true);
    }

    if (data.datasets.length >= MINIMAP_MAX_ANIMATED_DATASETS) {
      newState = newState.static;
    }

    if (!_isStateChanged(newState)) {
      return;
    }

    _state = proxyMerge(newState, { focusOn: null });
    clearCanvas(_canvas, _context);

    _drawDatasets(_state);
  }

  function toggle(shouldShow) {
    _element.classList.toggle('lovely-chart--state-hidden', !shouldShow);

    requestAnimationFrame(() => {
      _element.classList.toggle('lovely-chart--state-transparent', !shouldShow);
    });
  }

  function _setupLayout() {
    _element = createElement();

    _element.className = 'lovely-chart--minimap';
    _element.style.height = `${MINIMAP_HEIGHT}px`;

    _setupCanvas();
    _setupRuler();
    _setupLimitMask();

    container.appendChild(_element);

    _canvasSize = {
      width: _canvas.offsetWidth,
      height: _canvas.offsetHeight,
    };
  }

  function _getSize() {
    return {
      width: container.offsetWidth - MINIMAP_MARGIN * 2,
      height: MINIMAP_HEIGHT,
    };
  }

  function _setupCanvas() {
    const { canvas, context } = setupCanvas(_element, _getSize());

    _canvas = canvas;
    _context = context;
  }

  function _setupRuler() {
    _ruler = createElement();
    _ruler.className = 'lovely-chart--minimap-ruler';
    _ruler.innerHTML =
      '<div class="lovely-chart--minimap-mask"></div>' +
      '<div class="lovely-chart--minimap-slider">' +
      '<div class="lovely-chart--minimap-slider-handle"><span class="lovely-chart--minimap-slider-handle-pin"></span></div>' +
      '<div class="lovely-chart--minimap-slider-inner"></div>' +
      '<div class="lovely-chart--minimap-slider-handle"><span class="lovely-chart--minimap-slider-handle-pin"></span></div>' +
      '</div>' +
      '<div class="lovely-chart--minimap-mask"></div>';

    _slider = _ruler.children[1];

    captureEvents(
      _slider.children[1],
      {
        onCapture: _onDragCapture,
        onDrag: _onSliderDrag,
        onRelease: _onDragRelease,
        draggingCursor: 'grabbing',
      },
    );

    captureEvents(
      _slider.children[0],
      {
        onCapture: _onDragCapture,
        onDrag: _onLeftEarDrag,
        onRelease: _onDragRelease,
        draggingCursor: 'ew-resize',
      },
    );

    captureEvents(
      _slider.children[2],
      {
        onCapture: _onDragCapture,
        onDrag: _onRightEarDrag,
        onRelease: _onDragRelease,
        draggingCursor: 'ew-resize',
      },
    );

    _element.appendChild(_ruler);
  }

  function _setupLimitMask() {
    if (_limitBegin == null) return;

    _limitMask = createElement();
    _limitMask.className = 'lovely-chart--minimap-limit-mask';
    _limitMask.style.width = `${_limitBegin * 100}%`;
    _limitMask.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path fill-rule="evenodd" clip-rule="evenodd" d="M16.5265 10.2173V7.54299C16.5265 5.08532 14.4958 3.08585 11.9997 3.08585C9.50365 3.08585 7.47293 5.08532 7.47293 7.54299V10.2173C6.2992 10.2173 5.36524 11.2011 5.42629 12.3733L5.60706 15.844C5.6879 17.3962 5.72833 18.1723 6.00269 18.7852C6.39058 19.6518 7.10506 20.33 7.9906 20.6723C8.61698 20.9144 9.39412 20.9144 10.9484 20.9144H13.051C14.6053 20.9144 15.3825 20.9144 16.0088 20.6723C16.8944 20.33 17.6089 19.6518 17.9967 18.7852C18.2711 18.1723 18.3115 17.3962 18.3924 15.844L18.5731 12.3733C18.6342 11.2011 17.7002 10.2173 16.5265 10.2173ZM11.9997 4.8687C10.5023 4.8687 9.28364 6.06857 9.28364 7.54299V10.2173H14.7158V7.54299C14.7158 6.06857 13.4972 4.8687 11.9997 4.8687Z" fill="currentColor"/>' +
      '</svg>';
    if (data.onLimitedRangeClick) {
      _limitMask.classList.add('lovely-chart--state-interactive');
      _limitMask.addEventListener('click', data.onLimitedRangeClick);
    }
    _element.appendChild(_limitMask);
  }

  function _isStateChanged(newState) {
    if (!_state) {
      return true;
    }

    const { datasets } = data;

    if (datasets.some(({ key }) => _state[`opacity#${key}`] !== newState[`opacity#${key}`])) {
      return true;
    }

    if (_state.yMaxMinimap !== newState.yMaxMinimap) {
      return true;
    }

    return false;
  }

  function _drawDatasets(state = {}) {
    const { datasets } = data;
    const range = {
      from: 0,
      to: state.totalXWidth,
    };
    const boundsAndParams = {
      begin: 0,
      end: 1,
      totalXWidth: state.totalXWidth,
      yMin: state.yMinMinimap,
      yMax: state.yMaxMinimap,
      availableWidth: _canvasSize.width,
      availableHeight: _canvasSize.height,
      yPadding: 1,
    };
    const visibilities = datasets.map(({ key }) => _state[`opacity#${key}`]);
    const points = preparePoints(data, datasets, range, visibilities, boundsAndParams, true);
    const projection = createProjection(boundsAndParams);

    let secondaryPoints = null;
    let secondaryProjection = null;
    if (data.hasSecondYAxis) {
      const secondaryDataset = datasets.find((d) => d.hasOwnYAxis);
      const bounds = { yMin: state.yMinMinimapSecond, yMax: state.yMaxMinimapSecond };
      secondaryPoints = preparePoints(data, [secondaryDataset], range, visibilities, bounds)[0];
      secondaryProjection = projection.copy(bounds);
    }

    const totalPoints = points.reduce((a, p) => a + p.length, 0);
    const simplification = getSimplificationDelta(totalPoints) * SIMPLIFIER_MINIMAP_FACTOR;

    drawDatasets(
      _context, state, data,
      range, points, projection, secondaryPoints, secondaryProjection,
      MINIMAP_LINE_WIDTH, visibilities, colors, true, simplification,
    );
  }

  function _onDragCapture(e) {
    e.preventDefault();
    _capturedOffset = e.target.offsetLeft;
  }

  function _onDragRelease() {
    _capturedOffset = null;
  }

  function _onSliderDrag(moveEvent, captureEvent, { dragOffsetX }) {
    const limitX = _limitBegin != null ? _limitBegin * _canvasSize.width : 0;
    const minX1 = limitX;
    const maxX1 = _canvasSize.width - _slider.offsetWidth;

    const newX1 = Math.max(minX1, Math.min(_capturedOffset + dragOffsetX - MINIMAP_EAR_WIDTH, maxX1));
    const newX2 = newX1 + _slider.offsetWidth;
    const begin = newX1 / _canvasSize.width;
    const end = newX2 / _canvasSize.width;

    _updateRange({ begin, end });
  }

  function _onLeftEarDrag(moveEvent, captureEvent, { dragOffsetX }) {
    const limitX = _limitBegin != null ? _limitBegin * _canvasSize.width : 0;
    const minX1 = limitX;
    const maxX1 = _slider.offsetLeft + _slider.offsetWidth - MINIMAP_EAR_WIDTH * 2;

    const newX1 = Math.min(maxX1, Math.max(minX1, _capturedOffset + dragOffsetX));
    const begin = newX1 / _canvasSize.width;

    _updateRange({ begin });
  }

  function _onRightEarDrag(moveEvent, captureEvent, { dragOffsetX }) {
    const minX2 = _slider.offsetLeft + MINIMAP_EAR_WIDTH * 2;
    const maxX2 = _canvasSize.width;

    const newX2 = Math.max(minX2, Math.min(_capturedOffset + MINIMAP_EAR_WIDTH + dragOffsetX, maxX2));
    const end = newX2 / _canvasSize.width;

    _updateRange({ end });
  }

  function _updateRange(range, isExternal) {
    let nextRange = Object.assign({}, _range, range);

    if (_state && _state.minimapDelta && !isExternal) {
      nextRange = _adjustDiscreteRange(nextRange);
    }

    if (_limitBegin != null && nextRange.begin < _limitBegin) {
      nextRange.begin = _limitBegin;
    }

    if (nextRange.begin === _range.begin && nextRange.end === _range.end) {
      return;
    }

    _range = nextRange;
    _updateRulerOnRaf();

    if (!isExternal) {
      rangeCallback(_range);
    }
  }

  function _adjustDiscreteRange(nextRange) {
    // TODO sometimes beginChange and endChange are different for slider drag because of pixels division
    const begin = Math.round(nextRange.begin / _state.minimapDelta) * _state.minimapDelta;
    const end = Math.round(nextRange.end / _state.minimapDelta) * _state.minimapDelta;

    return { begin, end };
  }

  function _updateRuler() {
    const { begin, end } = _range;

    _ruler.children[0].style.width = `${begin * 100}%`;
    _ruler.children[1].style.width = `${(end - begin) * 100}%`;
    _ruler.children[2].style.width = `${(1 - end) * 100}%`;
  }

  return { update, toggle };
}
