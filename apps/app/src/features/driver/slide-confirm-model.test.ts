import { describe, expect, it } from "vitest";

import {
  initialSlideConfirmationState,
  resetIncompleteSlide,
  updateSlideConfirmation,
} from "./slide-confirm-model";

describe("slide confirmation", () => {
  it("does not confirm before reaching the threshold", () => {
    expect(updateSlideConfirmation(initialSlideConfirmationState, 0.91)).toEqual({
      progress: 0.91,
      confirmed: false,
    });
  });

  it("confirms only after the slide reaches the end threshold", () => {
    expect(updateSlideConfirmation(initialSlideConfirmationState, 0.92)).toEqual({
      progress: 0.92,
      confirmed: true,
    });
  });

  it("resets interrupted slides but preserves confirmed state", () => {
    const interrupted = updateSlideConfirmation(initialSlideConfirmationState, 0.5);
    expect(resetIncompleteSlide(interrupted)).toEqual(initialSlideConfirmationState);

    const confirmed = updateSlideConfirmation(initialSlideConfirmationState, 1);
    expect(resetIncompleteSlide(confirmed)).toEqual(confirmed);
  });

  it("clamps invalid progress", () => {
    expect(updateSlideConfirmation(initialSlideConfirmationState, -1).progress).toBe(0);
    expect(updateSlideConfirmation(initialSlideConfirmationState, 4).progress).toBe(1);
  });
});
