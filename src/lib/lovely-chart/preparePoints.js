import { sumArrays } from './utils.js';

export function preparePoints(data, datasets, range, visibilities, bounds, pieToArea) {
  let values = datasets.map(({ values }) => (
    values.slice(range.from, range.to + 1)
  ));

  if (data.isPie && !pieToArea) {
    values = prepareSumsByX(values);
  }

  const points = values.map((datasetValues, i) => (
    datasetValues.map((value, j) => {
      const isGap = value == null;
      let visibleValue = isGap ? 0 : value;

      if (data.isStacked && !isGap) {
        visibleValue *= visibilities[i];
      }

      return {
        labelIndex: range.from + j,
        value,
        visibleValue,
        stackOffset: 0,
        stackValue: visibleValue,
        gap: isGap,
      };
    })
  ));

  if (data.isPercentage) {
    preparePercentage(points, bounds);
  }

  if (data.isStacked) {
    prepareStacked(points);
  }

  return points;
}

function getSumsByY(points) {
  return sumArrays(points.map((datasetPoints) => (
    datasetPoints.map(({ visibleValue }) => visibleValue)
  )));
}

// TODO perf cache for [0..1], use in state
function preparePercentage(points, bounds) {
  const sumsByY = getSumsByY(points);

  points.forEach((datasetPoints) => {
    datasetPoints.forEach((point, j) => {
      point.percent = point.visibleValue / sumsByY[j];
      point.visibleValue = point.percent * bounds.yMax;
    });
  });
}

function prepareStacked(points) {
  const posAccum = [];
  const negAccum = [];

  points.forEach((datasetPoints) => {
    datasetPoints.forEach((point, j) => {
      if (posAccum[j] === undefined) {
        posAccum[j] = 0;
        negAccum[j] = 0;
      }

      if (point.gap) {
        point.stackOffset = posAccum[j];
        point.stackValue = posAccum[j];
        return;
      }

      if (point.visibleValue >= 0) {
        point.stackOffset = posAccum[j];
        posAccum[j] += point.visibleValue;
        point.stackValue = posAccum[j];
      } else {
        point.stackOffset = negAccum[j];
        negAccum[j] += point.visibleValue;
        point.stackValue = negAccum[j];
      }
    });
  });
}

function prepareSumsByX(values) {
  return values.map((datasetValues) => (
    [datasetValues.reduce((sum, value) => sum + value, 0)]
  ));
}
