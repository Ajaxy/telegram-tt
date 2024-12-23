import { setupCanvas, clearCanvas } from './canvas';
import { BALLOON_OFFSET, X_AXIS_HEIGHT } from './constants';
import { getPieRadius } from './formulas';
import {formatCryptoValue, formatInteger, getLabelDate, getLabelTime, statsFormatDayHourFull} from './format';
import { getCssColor } from './skin';
import { throttle, throttleWithRaf } from './utils';
import { addEventListener, createElement } from './minifiers';
import { toPixels } from './Projection';

export function createTooltip(container, data, plotSize, colors, onZoom, onFocus) {
  let _state;
  let _points;
  let _projection;
  let _secondaryPoints;
  let _secondaryProjection;

  let _element;
  let _canvas;
  let _context;
  let _balloon;

  let _offsetX;
  let _offsetY;
  let _clickedOnLabel = null;

  let _isZoomed = false;
  let _isZooming = false;

  const _selectLabelOnRaf = throttleWithRaf(_selectLabel);
  const _throttledUpdateContent = throttle(_updateContent, 100, true, true);

  _setupLayout();

  function update(state, points, projection, secondaryPoints, secondaryProjection) {
    _state = state;
    _points = points;
    _projection = projection;
    _secondaryPoints = secondaryPoints;
    _secondaryProjection = secondaryProjection;
    _selectLabel(true);
  }

  function toggleLoading(isLoading) {
    _balloon.classList.toggle('lovely-chart--state-loading', isLoading);

    if (!isLoading) {
      _clear();
    }
  }

  function toggleIsZoomed(isZoomed) {
    if (isZoomed !== _isZoomed) {
      _isZooming = true;
    }
    _isZoomed = isZoomed;
    _balloon.classList.toggle('lovely-chart--state-inactive', isZoomed);
  }

  function _setupLayout() {
    _element = createElement();
    _element.className = `lovely-chart--tooltip`;

    _setupCanvas();
    _setupBalloon();

    if ('ontouchstart' in window) {
      addEventListener(_element, 'touchmove', _onMouseMove);
      addEventListener(_element, 'touchstart', _onMouseMove);
      addEventListener(document, 'touchstart', _onDocumentMove);
    } else {
      addEventListener(_element, 'mousemove', _onMouseMove);
      addEventListener(_element, 'click', _onClick);
      addEventListener(document, 'mousemove', _onDocumentMove);
    }

    container.appendChild(_element);
  }

  function _setupCanvas() {
    const { canvas, context } = setupCanvas(_element, plotSize);

    _canvas = canvas;
    _context = context;
  }

  function _setupBalloon() {
    _balloon = createElement();
    _balloon.className = `lovely-chart--tooltip-balloon${!data.isZoomable ? ' lovely-chart--state-inactive' : ''}`;
    _balloon.innerHTML = '<div class="lovely-chart--tooltip-title"></div><div class="lovely-chart--tooltip-legend"></div><div class="lovely-chart--spinner"></div>';

    if ('ontouchstart' in window && data.isZoomable) {
      addEventListener(_balloon, 'click', _onBalloonClick);
    }

    _element.appendChild(_balloon);
  }

  function _onMouseMove(e) {
    if (e.target === _balloon || _balloon.contains(e.target) || _clickedOnLabel) {
      return;
    }

    _isZooming = false;

    const pageOffset = _getPageOffset(_element);
    _offsetX = (e.touches ? e.touches[0].clientX : e.clientX) - pageOffset.left;
    _offsetY = (e.touches ? e.touches[0].clientY : e.clientY) - pageOffset.top;

    _selectLabelOnRaf();
  }

  function _onDocumentMove(e) {
    if (_offsetX !== null && e.target !== _element && !_element.contains(e.target)) {
      _clear();
    }
  }

  function _onClick(e) {
    if (_isZooming) {
      return;
    }

    if (data.isZoomable) {
      const oldLabelIndex = _clickedOnLabel;

      _clickedOnLabel = null;
      _onMouseMove(e, true);

      const newLabelIndex = _getLabelIndex();
      if (newLabelIndex !== oldLabelIndex) {
        _clickedOnLabel = newLabelIndex;
      }

      onZoom(newLabelIndex);
    }
  }

  function _onBalloonClick() {
    if (_balloon.classList.contains('lovely-chart--state-inactive')) {
      return;
    }

    const labelIndex = _projection.findClosestLabelIndex(_offsetX);
    onZoom(labelIndex);
  }

  function _clear(isExternal) {
    _offsetX = null;
    _clickedOnLabel = null;
    clearCanvas(_canvas, _context);
    _hideBalloon();

    if (!isExternal && onFocus) {
      onFocus(null);
    }
  }

  function _getLabelIndex() {
    const labelIndex = _projection.findClosestLabelIndex(_offsetX);
    return labelIndex < _state.labelFromIndex || labelIndex > _state.labelToIndex ? null : labelIndex;
  }

  function _selectLabel(isExternal) {
    if (!_offsetX || !_state || _isZooming) {
      return;
    }

    const labelIndex = _getLabelIndex();
    if (labelIndex === null) {
      _clear(isExternal);
      return;
    }

    const pointerVector = getPointerVector();
    const shouldShowBalloon = data.isPie ? pointerVector.distance <= getPieRadius(_projection) : true;

    if (!isExternal && onFocus) {
      if (data.isPie) {
        onFocus(pointerVector);
      } else {
        onFocus(labelIndex);
      }
    }

    function getValue(values, labelIndex) {
      if (data.isPie) {
        return values.slice(_state.labelFromIndex, _state.labelToIndex + 1).reduce((a, x) => a + x, 0);
      }

      return values[labelIndex];
    }

    const [xPx] = toPixels(_projection, labelIndex, 0);
    const statistics = data.datasets
      .map(({ key, name, values, hasOwnYAxis }, i) => ({
        key,
        name,
        value: getValue(values, labelIndex),
        hasOwnYAxis,
        originalIndex: i,
      }))
      .filter(({ key }) => _state.filter[key]);

    if (statistics.length && shouldShowBalloon) {
      _updateBalloon(statistics, labelIndex);
    } else {
      _hideBalloon();
    }

    clearCanvas(_canvas, _context);
    if (data.isLines || data.isAreas) {
      if (data.isLines) {
        _drawCircles(statistics, labelIndex);
      }

      _drawTail(xPx, plotSize.height - X_AXIS_HEIGHT, getCssColor(colors, 'grid-lines'));
    }
  }

  function _drawCircles(statistics, labelIndex) {
    statistics.forEach(({ value, key, hasOwnYAxis, originalIndex }) => {
      const pointIndex = labelIndex - _state.labelFromIndex;
      const point = hasOwnYAxis ? _secondaryPoints[pointIndex] : _points[originalIndex][pointIndex];

      if (!point) {
        return;
      }

      const [x, y] = hasOwnYAxis
        ? toPixels(_secondaryProjection, labelIndex, point.stackValue)
        : toPixels(_projection, labelIndex, point.stackValue);

      // TODO animate
      _drawCircle(
        [x, y],
        getCssColor(colors, `dataset#${key}`),
        getCssColor(colors, 'background'),
      );
    });
  }

  function _drawCircle([xPx, yPx], strokeColor, fillColor) {
    _context.strokeStyle = strokeColor;
    _context.fillStyle = fillColor;
    _context.lineWidth = 2;

    _context.beginPath();
    _context.arc(xPx, yPx, 4, 0, 2 * Math.PI);
    _context.fill();
    _context.stroke();
  }

  function _drawTail(xPx, height, color) {
    _context.strokeStyle = color;
    _context.lineWidth = 1;

    _context.beginPath();
    _context.moveTo(xPx, 0);
    _context.lineTo(xPx, height);
    _context.stroke();
  }

  function _getBalloonLeftOffset(labelIndex) {
    const meanLabel = (_state.labelFromIndex + _state.labelToIndex) / 2;
    const { angle } = getPointerVector();

    const shouldPlaceRight = data.isPie ? angle > Math.PI / 2 : labelIndex < meanLabel;

    const leftOffset = shouldPlaceRight ? _offsetX + BALLOON_OFFSET : _offsetX - (_balloon.offsetWidth + BALLOON_OFFSET);

    return Math.min(Math.max(0, leftOffset), container.offsetWidth - _balloon.offsetWidth);
  }

  function _getBalloonTopOffset() {
    return data.isPie ? `${_offsetY}px` : 0;
  }

  function _updateBalloon(statistics, labelIndex) {
    _balloon.style.transform = `translate3D(${_getBalloonLeftOffset(labelIndex)}px, ${_getBalloonTopOffset()}, 0)`;
    _balloon.classList.add('lovely-chart--state-shown');

    if (data.isPie) {
      _updateContent(null, statistics);
    } else {
      _throttledUpdateContent(_getTitle(data, labelIndex), statistics);
    }
  }

  function _getTitle(data, labelIndex) {
    switch (data.tooltipFormatter) {
      case 'statsFormatDayHourFull':
        return statsFormatDayHourFull(data.xLabels[labelIndex].value);
      case 'statsTooltipFormat(\'day\')':
        return getLabelDate(data.xLabels[labelIndex]);
      case 'statsTooltipFormat(\'hour\')':
      case 'statsTooltipFormat(\'5min\')':
        return getLabelTime(data.xLabels[labelIndex]);
      default:
        return data.xLabels[labelIndex].text;
    }
  }

  function _isPieSectorSelected(statistics, value, totalValue, index, pointerVector) {
    const offset = index > 0 ? statistics.slice(0, index).reduce((a, x) => a + x.value, 0) : 0;
    const beginAngle = offset / totalValue * Math.PI * 2 - Math.PI / 2;
    const endAngle = (offset + value) / totalValue * Math.PI * 2 - Math.PI / 2;

    return pointerVector &&
      beginAngle <= pointerVector.angle &&
      pointerVector.angle < endAngle &&
      pointerVector.distance <= getPieRadius(_projection);
  }

  function _updateTitle(title) {
    const titleContainer = _balloon.children[0];

    if (data.isPie) {
      if (titleContainer) {
        titleContainer.style.display = 'none';
      }
    } else {
      if (titleContainer.style.display === 'none') {
        titleContainer.style.display = '';
      }
      const currentTitle = titleContainer.querySelector(':not(.lovely-chart--state-hidden)');

      if (!titleContainer.innerHTML || !currentTitle) {
        titleContainer.innerHTML = `<span>${title}</span>`;
      } else {
        currentTitle.innerHTML = title;
      }
    }
  }

  function _insertNewDataSet(dataSetContainer, { name, key, value }, totalValue) {
    const className = `lovely-chart--tooltip-dataset-value lovely-chart--position-right lovely-chart--color-${data.colors[key].slice(1)}`;
    const newDataSet = createElement();
    newDataSet.className = 'lovely-chart--tooltip-dataset';
    newDataSet.setAttribute('data-present', 'true');
    newDataSet.setAttribute('data-name', name);
    newDataSet.innerHTML = `<span class="lovely-chart--dataset-title">${name}</span><span class="${className}">${formatInteger(value)}</span>`;
    _renderPercentageValue(newDataSet, value, totalValue);

    const totalText = dataSetContainer.querySelector(`[data-total="true"]`);
    if (totalText) {
      dataSetContainer.insertBefore(newDataSet, totalText);
    } else {
      dataSetContainer.appendChild(newDataSet);
    }
  }

  function _updateDataSet(currentDataSet, { key, value } = {}, totalValue) {
    currentDataSet.setAttribute('data-present', 'true');

    const valueElement = currentDataSet.querySelector(`.lovely-chart--tooltip-dataset-value.lovely-chart--color-${data.colors[key].slice(1)}:not(.lovely-chart--state-hidden)`);

    if (data.isCurrency) {
      valueElement.innerHTML = formatCryptoValue(value);
    } else {
      valueElement.innerHTML = formatInteger(value);
    }

    _renderPercentageValue(currentDataSet, value, totalValue);
  }

  function _renderPercentageValue(dataSet, value, totalValue) {
    if (!data.isPercentage) {
      return;
    }

    if (data.isPie) {
      Array.from(dataSet.querySelectorAll(`.lovely-chart--percentage-title`)).forEach(e => e.remove());
      return;
    }

    const percentageValue = totalValue ? Math.round(value / totalValue * 100) : 0;
    const percentageElement = dataSet.querySelector(`.lovely-chart--percentage-title:not(.lovely-chart--state-hidden)`);

    if (!percentageElement) {
      const newPercentageTitle = createElement('span');
      newPercentageTitle.className = 'lovely-chart--percentage-title lovely-chart--position-left';
      newPercentageTitle.innerHTML = `${percentageValue}%`;
      dataSet.prepend(newPercentageTitle);
    } else {
      percentageElement.innerHTML = `${percentageValue}%`;
    }
  }

  function _updateDataSets(statistics) {
    const dataSetContainer = _balloon.children[1];
    if (data.isPie) {
      dataSetContainer.classList.add('lovely-chart--tooltip-legend-pie');
    }

    Array.from(dataSetContainer.children).forEach((dataSet) => {
      if (!data.isPie && dataSetContainer.classList.contains('lovely-chart--tooltip-legend-pie')) {
        dataSet.remove();
      } else {
        dataSet.setAttribute('data-present', 'false');
      }
    });

    const totalValue = statistics.reduce((a, x) => a + x.value, 0);
    const pointerVector = getPointerVector();
    const finalStatistics = data.isPie ? statistics.filter(({ value }, index) => _isPieSectorSelected(statistics, value, totalValue, index, pointerVector)) : statistics;

    finalStatistics.forEach((statItem) => {
      const currentDataSet = dataSetContainer.querySelector(`[data-name="${statItem.name}"]`);

      if (!currentDataSet) {
        _insertNewDataSet(dataSetContainer, statItem, totalValue);
      } else {
        _updateDataSet(currentDataSet, statItem, totalValue);
      }
    });

    if ((data.isBars || data.isSteps) && data.isStacked) {
      _renderTotal(dataSetContainer, formatInteger(totalValue));
    }

    if (data.isCurrency) {
      _renderCurrencyRate(dataSetContainer, formatCryptoValue(totalValue));
    }

    Array.from(dataSetContainer.querySelectorAll('[data-present="false"]'))
      .forEach((dataSet) => {
        dataSet.remove();
      });
  }

  function _updateContent(title, statistics) {
    _updateTitle(title);
    _updateDataSets(statistics);
  }

  function _renderTotal(dataSetContainer, totalValue) {
    const totalText = dataSetContainer.querySelector(`[data-total="true"]`);
    const className = `lovely-chart--tooltip-dataset-value lovely-chart--position-right`;
    if (!totalText) {
      const newTotalText = createElement();
      newTotalText.className = 'lovely-chart--tooltip-dataset';
      newTotalText.setAttribute('data-present', 'true');
      newTotalText.setAttribute('data-total', 'true');
      newTotalText.innerHTML = `<span>All</span><span class="${className}">${totalValue}</span>`;
      dataSetContainer.appendChild(newTotalText);
    } else {
      totalText.setAttribute('data-present', 'true');

      const valueElement = totalText.querySelector(`.lovely-chart--tooltip-dataset-value:not(.lovely-chart--state-hidden)`);
      valueElement.innerHTML = totalValue;
    }
  }

  function _renderCurrencyRate(dataSetContainer, totalValue) {
    const totalText = dataSetContainer.querySelector(`[data-total="true"]`);
    const className = `lovely-chart--tooltip-dataset-value lovely-chart--position-right`;

    const totalUsd = (parseFloat(totalValue) * data.currencyRate).toFixed(2);

    if (!totalText) {
      const newTotalText = createElement();
      newTotalText.className = 'lovely-chart--tooltip-dataset';
      newTotalText.setAttribute('data-present', 'true');
      newTotalText.setAttribute('data-total', 'true');
      newTotalText.innerHTML = `<span>USD ≈</span><span class="${className}">$${totalUsd}</span>`;
      dataSetContainer.appendChild(newTotalText);
    } else {
      totalText.setAttribute('data-present', 'true');

      const valueElement = totalText.querySelector(`.lovely-chart--tooltip-dataset-value:not(.lovely-chart--state-hidden)`);
      valueElement.innerHTML = `$${totalUsd}`;
    }
  }


  function _hideBalloon() {
    _balloon.classList.remove('lovely-chart--state-shown');
  }

  function getPointerVector() {
    const { width, height } = _element.getBoundingClientRect();

    const center = [width / 2, height / 2];
    const angle = Math.atan2(_offsetY - center[1], _offsetX - center[0]);
    const distance = Math.sqrt((_offsetX - center[0]) ** 2 + (_offsetY - center[1]) ** 2);

    return {
      angle: angle >= -Math.PI / 2 ? angle : 2 * Math.PI + angle,
      distance,
    };
  }

  function _getPageOffset(el) {
    return el.getBoundingClientRect();
  }

  return { update, toggleLoading, toggleIsZoomed };
}

