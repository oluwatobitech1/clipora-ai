/**
 * Hands a file picked on the landing page to the tool page the visitor chooses.
 * Kept in memory only: nothing is stored or uploaded.
 */
let pending: File | null = null;

export const setPendingFile = (file: File | null) => {
  pending = file;
};
export const peekPendingFile = () => pending;
export const clearPendingFile = () => {
  pending = null;
};
