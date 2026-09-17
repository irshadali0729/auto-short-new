/**
 * Proportionally scales scene durations so they sum to `targetLength`,
 * correcting rounding drift on the last scene. Used both client-side
 * (rescaling on-the-fly when the user edits the target length) and
 * server-side (analyze-transcript, when no real audio segments are
 * available to derive exact per-scene timing from).
 */
export function rescaleSceneDurations<T extends { duration: number }>(
  scenes: T[],
  targetLength: number,
): T[] {
  if (scenes.length === 0 || !Number.isFinite(targetLength) || targetLength <= 0) {
    return scenes;
  }

  const currentSum = scenes.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);

  const rescaled = currentSum > 0
    ? scenes.map((s) => ({
        ...s,
        duration: Number(((Number(s.duration) || 0) * (targetLength / currentSum)).toFixed(2)),
      }))
    : scenes.map((s) => ({
        ...s,
        duration: Number((targetLength / scenes.length).toFixed(2)),
      }));

  const newSum = rescaled.reduce((acc, s) => acc + s.duration, 0);
  const difference = targetLength - newSum;
  if (Math.abs(difference) > 0.001) {
    rescaled[rescaled.length - 1].duration = Number(
      (rescaled[rescaled.length - 1].duration + difference).toFixed(2),
    );
  }

  return rescaled;
}
