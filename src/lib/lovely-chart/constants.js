export const DPR = window.devicePixelRatio || 1;

export const DEFAULT_RANGE = { begin: 0.8, end: 1 };
export const TRANSITION_DEFAULT_DURATION = 300;
export const LONG_PRESS_TIMEOUT = 500;

export const GUTTER = 10;
export const PLOT_HEIGHT = 320;
export const PLOT_TOP_PADDING = 15;
export const PLOT_LINE_WIDTH = 2;
export const PLOT_PIE_RADIUS_FACTOR = 0.9 / 2;
export const PLOT_PIE_SHIFT = 10;
export const PLOT_BARS_WIDTH_SHIFT = 0.5;

export const PIE_MINIMUM_VISIBLE_PERCENT = 0.02;

export const BALLOON_OFFSET = 20;

export const AXES_FONT = '300 10px Helvetica, Arial, sans-serif';
export const AXES_MAX_COLUMN_WIDTH = 45;
export const AXES_MAX_ROW_HEIGHT = 50;
export const X_AXIS_HEIGHT = 30;
export const X_AXIS_SHIFT_START = 1;
export const Y_AXIS_ZERO_BASED_THRESHOLD = 0.1;

export const MINIMAP_HEIGHT = 40;
export const MINIMAP_MARGIN = 10;
export const MINIMAP_LINE_WIDTH = 1;
export const MINIMAP_EAR_WIDTH = 8;
export const MINIMAP_MAX_ANIMATED_DATASETS = 4;

export const ZOOM_TIMEOUT = TRANSITION_DEFAULT_DURATION;
export const ZOOM_RANGE_DELTA = 0.1;
export const ZOOM_RANGE_MIDDLE = .5;

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEK_DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const MILISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

export const SPEED_TEST_INTERVAL = 200;
export const SPEED_TEST_FAST_FPS = 4;

export const SIMPLIFIER_MIN_POINTS = 1000;
export const SIMPLIFIER_PLOT_FACTOR = 1;
export const SIMPLIFIER_MINIMAP_FACTOR = 0.5;

export const ANIMATE_PROPS = [
  // Viewport X-axis
  'begin 200 fast', 'end 200 fast', 'labelFromIndex 200 fast floor', 'labelToIndex 200 fast ceil',

  // X-axis labels
  'xAxisScale 400',

  // Viewport Y-axis
  'yMinViewport', 'yMaxViewport', 'yMinViewportSecond', 'yMaxViewportSecond',

  // Minimap Y-axis
  'yMinMinimap', 'yMaxMinimap', 'yMinMinimapSecond', 'yMaxMinimapSecond',

  // Y-axis labels
  'yAxisScale', 'yAxisScaleSecond',
];
