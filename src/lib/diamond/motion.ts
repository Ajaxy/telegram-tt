import { clamp } from '../../util/math';

// The turn and tilt of a standalone diamond. Angles are in radians, the pitch is an offset from the rest tilt of the
// model, times are in seconds.

type Rotation = {
  velocity: number;
  boost: number;
};

const STEP = 1 / 120;
const MAX_STEP_TIME = 0.05;
const SPRING_FREQUENCY = 3 * 2 * Math.PI;
const SPRING_DAMPING = 0.8;
const SPRING_STIFFNESS = SPRING_FREQUENCY * SPRING_FREQUENCY;
const SPRING_FRICTION = 2 * SPRING_DAMPING * SPRING_FREQUENCY;
const SWAY_AMPLITUDES = [0.17, 0.1];
const SWAY_PERIODS = [5.3, 8.9];
const PITCH_LIMIT = 1.1;
const PITCH_LIMIT_MARGIN = 0.001;
const MIN_DRAG_SCALE = 100;
const MIN_DRAG_STEP = 1 / 240;
const MAX_DRAG_STEP = 0.1;
const MAX_DRAG_VELOCITY = 5;
// A diamond let go within this time keeps the speed of the finger
const FLING_WINDOW = 0.12;
const RELEASE_NOD = 2.6;
const INERTIA_DECAY = 4.2;
const MIN_SPIN_DECAY = 0.05;
const MIN_SPIN_VELOCITY = 0.002;
const THROW_BOOST = 12.6;
const THROW_DECAY = 0.95 / 1.4;
const THROW_RESPONSE = 0.08;
const THROW_SETTLED = 0.001;
// The own turn resumes gradually after the finger lets go
const RESUME_DURATION = 0.75;
const FULL_TURN = 2 * Math.PI;

export default class DiamondMotion {
  yaw = 0;

  pitch = 0;

  isDragging = false;

  swayScale = 1;

  private targetYaw = 0;

  private targetPitch = 0;

  private rawPitchOffset = 0;

  private yawSpringVelocity = 0;

  private pitchSpringVelocity = 0;

  private yawVelocity = 0;

  private spinVelocity = 0;

  private spinDecay = 1;

  private lastDragTime = 0;

  private timeSinceRelease = RESUME_DURATION;

  private rotation?: Rotation;

  // Two incommensurate waves with random phases, so diamonds side by side do not nod in step
  private swayPhases = SWAY_PERIODS.map(() => Math.random() * FULL_TURN);

  clone() {
    const motion = Object.assign(new DiamondMotion(), this);
    motion.rotation = this.rotation && { ...this.rotation };

    return motion;
  }

  // Kicks add up; `decay` is the time in which a kick weakens e times
  spin(velocity: number, decay: number) {
    this.spinVelocity += velocity;
    this.spinDecay = Math.max(decay, MIN_SPIN_DECAY);
  }

  fling(direction: number) {
    this.rotation = { velocity: this.yawSpringVelocity, boost: direction * THROW_BOOST };
    this.targetYaw = this.yaw;
    this.yawSpringVelocity = 0;
    this.yawVelocity = 0;
    this.timeSinceRelease = RESUME_DURATION;
  }

  begin(time: number) {
    this.isDragging = true;
    this.rotation = undefined;
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;

    // The pitch eases towards its limit, so the raw offset is the inverse of that easing
    const offset = clamp(this.pitch, PITCH_LIMIT_MARGIN - PITCH_LIMIT, PITCH_LIMIT - PITCH_LIMIT_MARGIN);
    this.rawPitchOffset = offset / (1 - Math.abs(offset) / PITCH_LIMIT);
    this.yawSpringVelocity = 0;
    this.pitchSpringVelocity = 0;
    this.yawVelocity = 0;
    this.spinVelocity = 0;
    this.lastDragTime = time;
  }

  drag(deltaX: number, deltaY: number, scale: number, time: number) {
    if (!this.isDragging) return;

    const sensitivity = Math.PI / Math.max(scale, MIN_DRAG_SCALE);
    const deltaYaw = deltaX * sensitivity;
    this.targetYaw += deltaYaw;
    this.rawPitchOffset += deltaY * sensitivity;
    this.targetPitch = this.rawPitchOffset / (1 + Math.abs(this.rawPitchOffset) / PITCH_LIMIT);

    const step = clamp(time - this.lastDragTime, MIN_DRAG_STEP, MAX_DRAG_STEP);
    this.yawVelocity = clamp(deltaYaw / step, -MAX_DRAG_VELOCITY, MAX_DRAG_VELOCITY);
    this.lastDragTime = time;
  }

  end(time: number, isCancelled?: boolean) {
    this.isDragging = false;
    this.timeSinceRelease = 0;
    this.targetPitch = 0;

    if (isCancelled) {
      this.targetYaw = this.yaw;
      this.yawVelocity = 0;
      this.yawSpringVelocity = 0;
      this.pitchSpringVelocity = 0;
      return;
    }

    this.pitchSpringVelocity -= RELEASE_NOD;
    if (time - this.lastDragTime > FLING_WINDOW) this.yawVelocity = 0;
  }

  step(duration: number, speed: number, time: number) {
    let remaining = clamp(duration, 0, MAX_STEP_TIME);

    while (remaining > 0) {
      const step = Math.min(remaining, STEP);
      const stepTime = Math.max(0, time - remaining + step);

      if (!this.isDragging) {
        this.stepFree(step, speed);
        this.targetPitch = this.getSway(stepTime);
      }

      this.yawSpringVelocity += ((this.targetYaw - this.yaw) * SPRING_STIFFNESS
        - SPRING_FRICTION * this.yawSpringVelocity) * step;
      this.pitchSpringVelocity += ((this.targetPitch - this.pitch) * SPRING_STIFFNESS
        - SPRING_FRICTION * this.pitchSpringVelocity) * step;
      this.yaw += this.yawSpringVelocity * step;
      this.pitch += this.pitchSpringVelocity * step;
      remaining -= step;
    }

    const fullTurns = Math.trunc(this.yaw / FULL_TURN) * FULL_TURN;
    this.yaw -= fullTurns;
    this.targetYaw -= fullTurns;
  }

  private stepFree(step: number, speed: number) {
    this.timeSinceRelease += step;

    const inertia = Math.exp(-INERTIA_DECAY * step);
    this.targetYaw += (this.yawVelocity * (1 - inertia)) / INERTIA_DECAY;
    this.yawVelocity *= inertia;

    const spinFade = Math.exp(-step / this.spinDecay);
    const spun = this.spinVelocity * this.spinDecay * (1 - spinFade);
    this.spinVelocity = Math.abs(this.spinVelocity * spinFade) < MIN_SPIN_VELOCITY ? 0 : this.spinVelocity * spinFade;
    this.targetYaw += spun;
    this.yaw += spun;

    let travel = speed * step;
    const { rotation } = this;
    if (rotation) {
      const previous = rotation.velocity;
      rotation.boost *= Math.exp(-step / THROW_DECAY);
      rotation.velocity += (speed + rotation.boost - rotation.velocity) * (1 - Math.exp(-step / THROW_RESPONSE));
      travel = ((previous + rotation.velocity) / 2) * step;

      if (Math.abs(rotation.boost) < THROW_SETTLED && Math.abs(rotation.velocity - speed) < THROW_SETTLED) {
        this.rotation = undefined;
      }
    }

    travel *= Math.min(this.timeSinceRelease / RESUME_DURATION, 1);
    this.targetYaw += travel;
    this.yaw += travel;
  }

  private getSway(time: number) {
    return this.swayScale * SWAY_AMPLITUDES.reduce((sum, amplitude, i) => (
      sum + amplitude * Math.sin((FULL_TURN / SWAY_PERIODS[i]) * time + this.swayPhases[i])
    ), 0);
  }
}
