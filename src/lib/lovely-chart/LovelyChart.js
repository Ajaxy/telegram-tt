import { createStateManager } from './StateManager';
import { createHeader } from './Header';
import { createAxes } from './Axes';
import { createMinimap } from './Minimap';
import { createTooltip } from './Tooltip';
import { createTools } from './Tools';
import { createZoomer } from './Zoomer';
import { createColors } from './skin';
import { analyzeData } from './data';
import { setupCanvas, clearCanvas } from './canvas';
import { preparePoints } from './preparePoints';
import { createProjection } from './Projection';
import { drawDatasets } from './drawDatasets';
import { createElement } from './minifiers';
import { getFullLabelDate, getLabelDate } from './format';
import {
  X_AXIS_HEIGHT,
  GUTTER,
  PLOT_TOP_PADDING,
  PLOT_HEIGHT,
  PLOT_LINE_WIDTH,
  SIMPLIFIER_PLOT_FACTOR,
} from './constants';
import { getSimplificationDelta, isDataRange } from './formulas';
import { debounce } from './utils';
import './styles/index.scss';

function create(container, originalData) {
  let _stateManager;

  let _element;
  let _plot;
  let _context;
  let _plotSize;

  let _header;
  let _axes;
  let _minimap;
  let _tooltip;
  let _tools;
  let _zoomer;

  let _state;
  let _windowWidth = window.innerWidth;

  const _data = analyzeData(originalData);
  const _colors = createColors(_data.colors);
  const _redrawDebounced = debounce(_redraw, 500, false, true);

  _setupComponents();
  _setupGlobalListeners();

  function _setupComponents() {
    _setupContainer();
    _header = createHeader(_element, _data.title, _data.zoomOutLabel, _onZoomOut);
    _setupPlotCanvas();
    _stateManager = createStateManager(_data, _plotSize, _onStateUpdate);
    _axes = createAxes(_context, _data, _plotSize, _colors);
    _minimap = createMinimap(_element, _data, _colors, _onRangeChange);
    _tooltip = createTooltip(_element, _data, _plotSize, _colors, _onZoomIn, _onFocus);
    _tools = createTools(_element, _data, _onFilterChange);
    _zoomer = _data.isZoomable && createZoomer(_data, originalData, _colors, _stateManager, _element, _header, _minimap, _tooltip, _tools);
    // hideOnScroll(_element);
  }

  function _setupContainer() {
    _element = createElement();
    _element.className = `lovely-chart--container${_data.shouldZoomToPie ? ' lovely-chart--container-type-pie' : ''}`;

    container.appendChild(_element);
  }

  function _setupPlotCanvas() {
    const { canvas, context } = setupCanvas(_element, {
      width: _element.clientWidth,
      height: PLOT_HEIGHT,
    });

    _plot = canvas;
    _context = context;

    _plotSize = {
      width: _plot.offsetWidth,
      height: _plot.offsetHeight,
    };
  }

  function _onStateUpdate(state) {
    _state = state;

    const { datasets } = _data;
    const range = {
      from: state.labelFromIndex,
      to: state.labelToIndex,
    };
    const boundsAndParams = {
      begin: state.begin,
      end: state.end,
      totalXWidth: state.totalXWidth,
      yMin: state.yMinViewport,
      yMax: state.yMaxViewport,
      availableWidth: _plotSize.width,
      availableHeight: _plotSize.height - X_AXIS_HEIGHT,
      xPadding: GUTTER,
      yPadding: PLOT_TOP_PADDING,
    };
    const visibilities = datasets.map(({ key }) => state[`opacity#${key}`]);
    const points = preparePoints(_data, datasets, range, visibilities, boundsAndParams);
    const projection = createProjection(boundsAndParams);

    let secondaryPoints = null;
    let secondaryProjection = null;
    if (_data.hasSecondYAxis) {
      const secondaryDataset = datasets.find((d) => d.hasOwnYAxis);
      const bounds = {
        yMin: state.yMinViewportSecond,
        yMax: state.yMaxViewportSecond,
      };
      secondaryPoints = preparePoints(_data, [secondaryDataset], range, visibilities, bounds)[0];
      secondaryProjection = projection.copy(bounds);
    }

    if (!_data.hideCaption) {
      _header.setCaption(_getCaption(state));
    }

    clearCanvas(_plot, _context);

    const totalPoints = points.reduce((a, p) => a + p.length, 0);
    const simplification = getSimplificationDelta(totalPoints) * SIMPLIFIER_PLOT_FACTOR;

    drawDatasets(
      _context, state, _data,
      range, points, projection, secondaryPoints, secondaryProjection,
      PLOT_LINE_WIDTH, visibilities, _colors, false, simplification,
    );
    if (!_data.isPie) {
      _axes.drawYAxis(state, projection, secondaryProjection);
      // TODO check isChanged
      _axes.drawXAxis(state, projection);
    }
    _minimap.update(state);
    _tooltip.update(state, points, projection, secondaryPoints, secondaryProjection);
  }

  function _onRangeChange(range) {
    _stateManager.update({ range });
  }

  function _onFilterChange(filter) {
    _stateManager.update({ filter });
  }

  function _onFocus(focusOn) {
    if (_data.isBars || _data.isPie || _data.isSteps) {
      // TODO animate
      _stateManager.update({ focusOn });
    }
  }

  function _onZoomIn(labelIndex) {
    _zoomer.zoomIn(_state, labelIndex);
  }

  function _onZoomOut() {
    _zoomer.zoomOut(_state);
  }

  function _setupGlobalListeners() {
    document.documentElement.addEventListener('darkmode', () => {
      _stateManager.update();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth !== _windowWidth) {
        _windowWidth = window.innerWidth;
        _redrawDebounced();
      }
    });

    window.addEventListener('orientationchange', () => {
      _redrawDebounced();
    });
  }

  function _redraw() {
    Object.assign(_data, analyzeData(originalData));
    _element.remove();
    _setupComponents();
  }

  function _getCaption(state) {
    let startIndex;
    let endIndex;

    if (_zoomer && _zoomer.isZoomed()) {
      // TODO Fix label
      startIndex = state.labelFromIndex === 0 ? 0 : state.labelFromIndex + 1;
      endIndex = state.labelToIndex === state.totalXWidth - 1 ? state.labelToIndex : state.labelToIndex - 1;
    } else {
      startIndex = state.labelFromIndex;
      endIndex = state.labelToIndex;
    }

    return isDataRange(_data.xLabels[startIndex], _data.xLabels[endIndex])
      ? (
        `${getLabelDate(_data.xLabels[startIndex])}` +
        ' — ' +
        `${getLabelDate(_data.xLabels[endIndex])}`
      )
      : getFullLabelDate(_data.xLabels[startIndex]);
  }
}

export { create };
