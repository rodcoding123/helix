declare module 'jsonpath' {
  export function query(obj: unknown, path: string): unknown[];
  export function paths(obj: unknown, filter?: (x: unknown) => boolean): unknown[];
  export function parse(path: string): unknown[];
  export function stringify(path: unknown[]): string;
  export function value(obj: unknown, path: string): unknown;
  export function parent(obj: unknown, path: string): unknown;
  export function apply(obj: unknown, path: string, fn: (x: unknown) => unknown): unknown;
}
