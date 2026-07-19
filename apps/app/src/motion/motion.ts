export type MotionProfile = Readonly<{
  enterDurationMs: number;
  feedbackDurationMs: number;
  overlayDurationMs: number;
  enterTranslateY: number;
  pressedScale: number;
}>;

const standardMotion: MotionProfile = Object.freeze({
  enterDurationMs: 220,
  feedbackDurationMs: 160,
  overlayDurationMs: 240,
  enterTranslateY: 8,
  pressedScale: 0.985,
});

const reducedMotion: MotionProfile = Object.freeze({
  enterDurationMs: 0,
  feedbackDurationMs: 0,
  overlayDurationMs: 0,
  enterTranslateY: 0,
  pressedScale: 1,
});

export function resolveMotionProfile(reduceMotion: boolean): MotionProfile {
  return reduceMotion ? reducedMotion : standardMotion;
}
