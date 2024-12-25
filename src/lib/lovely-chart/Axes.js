import { GUTTER, AXES_FONT, X_AXIS_HEIGHT, X_AXIS_SHIFT_START, PLOT_TOP_PADDING } from './constants';
import { formatCryptoValue, humanize } from './format';
import { getCssColor } from './skin';
import { applyXEdgeOpacity, applyYEdgeOpacity, xScaleLevelToStep, yScaleLevelToStep } from './formulas';
import { toPixels } from './Projection';

export function createAxes(context, data, plotSize, colors) {
  function drawXAxis(state, projection) {
    context.clearRect(0, plotSize.height - X_AXIS_HEIGHT + 1, plotSize.width, X_AXIS_HEIGHT + 1);

    const topOffset = plotSize.height - X_AXIS_HEIGHT / 2;
    const scaleLevel = Math.floor(state.xAxisScale);
    const step = xScaleLevelToStep(scaleLevel);
    const opacityFactor = 1 - (state.xAxisScale - scaleLevel);

    context.font = AXES_FONT;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    for (let i = state.labelFromIndex; i <= state.labelToIndex; i++) {
      const shiftedI = i - X_AXIS_SHIFT_START;

      if (shiftedI % step !== 0) {
        continue;
      }

      const label = data.xLabels[i];
      const [xPx] = toPixels(projection, i, 0);
      let opacity = shiftedI % (step * 2) === 0 ? 1 : opacityFactor;
      opacity = applyYEdgeOpacity(opacity, xPx, plotSize.width);

      context.fillStyle = getCssColor(colors, 'x-axis-text', opacity);
      context.fillText(label.text, xPx, topOffset);
    }
  }

  function drawYAxis(state, projection, secondaryProjection) {
    const {
      yAxisScale, yAxisScaleFrom, yAxisScaleTo, yAxisScaleProgress = 0,
      yMinViewport, yMinViewportFrom, yMinViewportTo,
      yMaxViewport, yMaxViewportFrom, yMaxViewportTo,
      yMinViewportSecond, yMinViewportSecondFrom, yMinViewportSecondTo,
      yMaxViewportSecond, yMaxViewportSecondFrom, yMaxViewportSecondTo,
    } = state;
    const colorKey = secondaryProjection && `dataset#${data.datasets[0].key}`;
    const isYChanging = yMinViewportFrom !== undefined || yMaxViewportFrom !== undefined;

    if (data.isPercentage) {
      _drawYAxisPercents(projection);
    } else if (data.isCurrency) {
      _drawYAxisCurrency(projection, data);
    } else {
      _drawYAxisScaled(
        state,
        projection,
        Math.round(yAxisScaleTo || yAxisScale),
        yMinViewportTo !== undefined ? yMinViewportTo : yMinViewport,
        yMaxViewportTo !== undefined ? yMaxViewportTo : yMaxViewport,
        yAxisScaleFrom ? yAxisScaleProgress : 1,
        colorKey,
      );
    }

    if (yAxisScaleProgress > 0 && isYChanging) {
      _drawYAxisScaled(
        state,
        projection,
        Math.round(yAxisScaleFrom),
        yMinViewportFrom !== undefined ? yMinViewportFrom : yMinViewport,
        yMaxViewportFrom !== undefined ? yMaxViewportFrom : yMaxViewport,
        1 - yAxisScaleProgress,
        colorKey,
      );
    }

    if (secondaryProjection) {
      const { yAxisScaleSecond, yAxisScaleSecondFrom, yAxisScaleSecondTo, yAxisScaleSecondProgress = 0 } = state;
      const secondaryColorKey = `dataset#${data.datasets[data.datasets.length - 1].key}`;
      const isYChanging = yMinViewportSecondFrom !== undefined || yMaxViewportSecondFrom !== undefined;

      _drawYAxisScaled(
        state,
        secondaryProjection,
        Math.round(yAxisScaleSecondTo || yAxisScaleSecond),
        yMinViewportSecondTo !== undefined ? yMinViewportSecondTo : yMinViewportSecond,
        yMaxViewportSecondTo !== undefined ? yMaxViewportSecondTo : yMaxViewportSecond,
        yAxisScaleSecondFrom ? yAxisScaleSecondProgress : 1,
        secondaryColorKey,
        true,
      );

      if (yAxisScaleSecondProgress > 0 && isYChanging) {
        _drawYAxisScaled(
          state,
          secondaryProjection,
          Math.round(yAxisScaleSecondFrom),
          yMinViewportSecondFrom !== undefined ? yMinViewportSecondFrom : yMinViewportSecond,
          yMaxViewportSecondFrom !== undefined ? yMaxViewportSecondFrom : yMaxViewportSecond,
          1 - yAxisScaleSecondProgress,
          secondaryColorKey,
          true,
        );
      }
    }
  }

  function _drawYAxisScaled(state, projection, scaleLevel, yMin, yMax, opacity = 1, colorKey = null, isSecondary = false) {
    const step = yScaleLevelToStep(scaleLevel);
    const firstVisibleValue = Math.ceil(yMin / step) * step;
    const lastVisibleValue = Math.floor(yMax / step) * step;

    context.font = AXES_FONT;
    context.textAlign = isSecondary ? 'right' : 'left';
    context.textBaseline = 'bottom';

    context.lineWidth = 1;

    context.beginPath();

    for (let value = firstVisibleValue; value <= lastVisibleValue; value += step) {
      const [, yPx] = toPixels(projection, 0, value);
      const textOpacity = applyXEdgeOpacity(opacity, yPx);

      context.fillStyle = colorKey
        ? getCssColor(colors, colorKey, textOpacity)
        : getCssColor(colors, 'y-axis-text', textOpacity);

      if (!isSecondary) {
        context.fillText(humanize(value), GUTTER, yPx - GUTTER / 2);
      } else {
        context.fillText(humanize(value), plotSize.width - GUTTER, yPx - GUTTER / 2);
      }

      if (isSecondary) {
        context.strokeStyle = getCssColor(colors, colorKey, opacity);

        context.moveTo(plotSize.width - GUTTER, yPx);
        context.lineTo(plotSize.width - GUTTER * 2, yPx);
      } else {
        context.moveTo(GUTTER, yPx);
        context.strokeStyle = getCssColor(colors, 'grid-lines', opacity);
        context.lineTo(plotSize.width - GUTTER, yPx);
      }
    }

    context.stroke();
  }

  function _drawYAxisPercents(projection) {
    const percentValues = [0, 0.25, 0.50, 0.75, 1];
    const [, height] = projection.getSize();

    context.font = AXES_FONT;
    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.lineWidth = 1;

    context.beginPath();

    percentValues.forEach((value) => {
      const yPx = height - height * value + PLOT_TOP_PADDING;

      context.fillStyle = getCssColor(colors, 'y-axis-text', 1);
      context.fillText(`${value * 100}%`, GUTTER, yPx - GUTTER / 4);

      context.moveTo(GUTTER, yPx);
      context.strokeStyle = getCssColor(colors, 'grid-lines', 1);
      context.lineTo(plotSize.width - GUTTER, yPx);
    });

    context.stroke();
  }

  function _drawYAxisCurrency(projection, data) {
    const formatValue = data.datasets[0].values.map(value => formatCryptoValue(value));

    const total = formatValue.reduce((sum, value) => sum + value, 0);
    const avg1 = total / formatValue.length;
    const avg2 = total / (formatValue.length / 2);
    const avg3 = total / (formatValue.length / 3);

    const averageRate1 = avg1 * data.currencyRate;
    const averageRate2 = avg2 * data.currencyRate;
    const averageRate3 = avg3 * data.currencyRate;

    const totalAvg = [0, avg1, avg2, avg3];
    const totalRate = [0, averageRate1, averageRate2, averageRate3];

    const [, height] = projection.getSize();

    context.font = AXES_FONT;
    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.lineWidth = 1;

    context.beginPath();

    totalAvg.forEach((value, index) => {
      const yPx = height - height * (value / Math.max(...formatValue)) + PLOT_TOP_PADDING;

      context.fillStyle = getCssColor(colors, 'y-axis-text', 1);

      context.fillText(`${value.toFixed(2)} TON`, GUTTER, yPx - GUTTER / 4);

      context.textAlign = 'right';
      context.fillText(`$${totalRate[index].toFixed(2)}`, plotSize.width - GUTTER, yPx - GUTTER / 4);

      context.textAlign = 'left';

      context.moveTo(GUTTER, yPx);
      context.strokeStyle = getCssColor(colors, 'grid-lines', 1);
      context.lineTo(plotSize.width - GUTTER, yPx);
    });

    context.stroke();
  }

  return { drawXAxis, drawYAxis };
}
