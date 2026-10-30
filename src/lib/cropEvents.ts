export function shouldCommitCropEvent(
  userActionInProgress: boolean,
  sliderChanging: boolean,
): boolean {
  return userActionInProgress && !sliderChanging
}
