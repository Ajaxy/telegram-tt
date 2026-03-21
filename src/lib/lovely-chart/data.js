import { getMaxMin } from './utils.js';
import { statsFormatDay, statsFormatDayHour, statsFormatText, statsFormatMin } from './format.js';

const LABEL_TYPE_TO_FORMATTER = {
  'day': "statsFormat('day')",
  'hour': "statsFormat('hour')",
  '5min': "statsFormat('5min')",
  'dayHour': 'statsFormatDayHour',
  'text': undefined,
};

export function analyzeData(data) {
  const { title, labelFormatter: labelFormatterRaw, labelType, tooltipFormatter, isStacked, isPercentage, secondaryYAxis, hasSecondYAxis, onZoom, minimapRange, hideCaption, zoomOutLabel, valuePrefix, valueSuffix } = data;
  const labelFormatter = labelFormatterRaw || (labelType && LABEL_TYPE_TO_FORMATTER[labelType]);
  const { datasets, labels } = prepareDatasets(data);

  const colors = {};
  let totalYMin = Infinity;
  let totalYMax = -Infinity;
  datasets.forEach(({ key, color, yMin, yMax }) => {
    colors[key] = color;

    if (yMin < totalYMin) {
      totalYMin = yMin;
    }

    if (yMax > totalYMax) {
      totalYMax = yMax;
    }
  });

  let xLabels;
  switch (labelFormatter) {
    case 'statsFormatDayHour':
      xLabels = statsFormatDayHour(labels);
      break;
    case 'statsFormat(\'day\')':
      xLabels = statsFormatDay(labels);
      break;
    case 'statsFormat(\'hour\')':
    case 'statsFormat(\'5min\')':
      xLabels = statsFormatMin(labels);
      break;
    default:
      xLabels = statsFormatText(labels);
      break;
  }

  const analyzed = {
    title,
    labelFormatter,
    tooltipFormatter,
    xLabels,
    datasets,
    isStacked,
    isPercentage,
    secondaryYAxis,
    hasSecondYAxis,
    valuePrefix,
    valueSuffix,
    onZoom,
    isLines: data.type === 'line',
    isBars: data.type === 'bar',
    isSteps: data.type === 'step',
    isAreas: data.type === 'area',
    isPie: data.type === 'pie',
    yMin: totalYMin,
    yMax: totalYMax,
    colors,
    minimapRange,
    hideCaption,
    zoomOutLabel,
  };

  analyzed.shouldZoomToPie = !analyzed.onZoom && analyzed.isPercentage;
  analyzed.isZoomable = analyzed.onZoom || analyzed.shouldZoomToPie;

  return analyzed;
}

function prepareDatasets(data) {
  const { type, labels, datasets, hasSecondYAxis } = data;

  return {
    labels: cloneArray(labels),
    datasets: datasets.map(({ name, color, values }, i) => {
      const { min: yMin, max: yMax } = getMaxMin(values);

      return {
        type,
        key: `y${i}`,
        name,
        color,
        values: cloneArray(values),
        hasOwnYAxis: hasSecondYAxis && i === datasets.length - 1,
        yMin,
        yMax,
      };
    }),
  };
}

function cloneArray(array) {
  return array.slice(0);
}
