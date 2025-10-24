import * as fuzzball from 'fuzzball';

/**
 * Checks if a user's text answer is correct, handling semantic similarity and numeric ranges.
 * @param userAnswer The text provided by the user.
 * @param correctAnswerText The correct answer string from the database.
 * @returns True if the answer is considered correct, otherwise false.
 */
export const checkTextAnswer = (
  userAnswer: string,
  correctAnswerText: string,
): boolean => {
  const cleanedUserAnswer = userAnswer.trim().toLowerCase();
  const cleanedCorrectAnswer = correctAnswerText.trim().toLowerCase();

  const rangeRegex = /^(\d+)-(\d+)$/;
  const rangeMatch = cleanedCorrectAnswer.match(rangeRegex);

  if (rangeMatch) {
    const userNumber = parseFloat(cleanedUserAnswer);
    if (isNaN(userNumber)) {
      return false;
    }
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    const lowerBound = Math.min(min, max);
    const upperBound = Math.max(min, max);
    return userNumber >= lowerBound && userNumber <= upperBound;
  }

  const similarity = fuzzball.ratio(cleanedUserAnswer, cleanedCorrectAnswer);

  const SIMILARITY_THRESHOLD = 80;

  return similarity >= SIMILARITY_THRESHOLD;
};
