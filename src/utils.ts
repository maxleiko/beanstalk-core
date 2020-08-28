export function envNumber(value: string | undefined): number | undefined {
  if (!value) {
    return;
  }
  return parseInt(value, 10);
}

export function envBool(value: string | undefined): boolean | undefined {
  if (!value) {
    return;
  }
  return value === 'true';
}