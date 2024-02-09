export function stringify(token: any): string {
  return String(token.name ?? token).replace(/\n.*/g, '');
}