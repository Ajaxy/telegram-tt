import { SPEED_TEST_FAST_FPS, SPEED_TEST_INTERVAL, TRANSITION_DEFAULT_DURATION } from './constants';

function transition(t) {
  // faster
  // return -t * (t - 2);
  // easeOut
  return 1 - Math.pow(1 - t, 1.675);
}

export function createTransitionManager(onTick) {
  const _transitions = {};

  let _nextFrame = null;

  let _testStartedAt = null;
  let _fps = null;
  let _testingFps = null;
  let _slowDetectedAt = null;
  let _startedAsSlow = null;

  function add(prop, from, to, duration, options) {
    _transitions[prop] = {
      from,
      to,
      duration,
      options,
      current: from,
      startedAt: Date.now(),
      progress: 0,
    };

    if (!_nextFrame) {
      _resetSpeedTest();
      _nextFrame = requestAnimationFrame(_tick);
    }
  }

  function remove(prop) {
    delete _transitions[prop];

    if (!isRunning()) {
      cancelAnimationFrame(_nextFrame);
      _nextFrame = null;
    }
  }

  function get(prop) {
    return _transitions[prop];
  }

  function getState() {
    const state = {};

    Object.keys(_transitions).forEach((prop) => {
      const { current, from, to, progress } = _transitions[prop];
      state[prop] = current;
      // TODO perf lazy
      state[`${prop}From`] = from;
      state[`${prop}To`] = to;
      state[`${prop}Progress`] = progress;
    });

    return state;
  }

  function isRunning() {
    return Boolean(Object.keys(_transitions).length);
  }

  function isFast(forceCheck) {
    if (!forceCheck && (_startedAsSlow || _slowDetectedAt)) {
      return false;
    }

    return _fps === null || _fps >= SPEED_TEST_FAST_FPS;
  }

  function _tick() {
    const isSlow = !isFast();
    _speedTest();

    const state = {};

    Object.keys(_transitions).forEach((prop) => {
      const { startedAt, from, to, duration = TRANSITION_DEFAULT_DURATION, options } = _transitions[prop];
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      let current = from + (to - from) * transition(progress);

      if (options.includes('ceil')) {
        current = Math.ceil(current);
      } else if (options.includes('floor')) {
        current = Math.floor(current);
      }

      _transitions[prop].current = current;
      _transitions[prop].progress = progress;
      state[prop] = current;

      if (progress === 1) {
        remove(prop);
      }
    });

    if (!isSlow) {
      onTick(state);
    }

    if (isRunning()) {
      _nextFrame = requestAnimationFrame(_tick);
    }
  }

  function _resetSpeedTest() {
    _testStartedAt = null;
    _testingFps = null;
    if (_slowDetectedAt && Date.now() - _slowDetectedAt > 5000) {
      _slowDetectedAt = null;
    }
    _startedAsSlow = Boolean(_slowDetectedAt) || !isFast(true);
  }

  function _speedTest() {
    if (!_testStartedAt || (Date.now() - _testStartedAt) >= SPEED_TEST_INTERVAL) {
      if (_testingFps) {
        _fps = _testingFps;
        if (!_slowDetectedAt && !isFast(true)) {
          _slowDetectedAt = Date.now();
        }
      }
      _testStartedAt = Date.now();
      _testingFps = 0;
    } else {
      _testingFps++;
    }
  }

  return { add, remove, get, getState, isRunning, isFast };
}
