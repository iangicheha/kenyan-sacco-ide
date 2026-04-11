export function ForbiddenError(message: string): Error {
  const err = new Error(message);
  err.name = "ForbiddenError";
  return err;
}
