export type SlideConfirmationState = Readonly<{
  progress: number;
  confirmed: boolean;
}>;

export const initialSlideConfirmationState: SlideConfirmationState = {
  progress: 0,
  confirmed: false,
};

export function updateSlideConfirmation(
  state: SlideConfirmationState,
  nextProgress: number,
  threshold = 0.92,
): SlideConfirmationState {
  if (state.confirmed) return state;
  const progress = Math.max(0, Math.min(1, nextProgress));
  return {
    progress,
    confirmed: progress >= threshold,
  };
}

export function resetIncompleteSlide(
  state: SlideConfirmationState,
): SlideConfirmationState {
  return state.confirmed ? state : initialSlideConfirmationState;
}
