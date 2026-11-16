// @types/jest-axe drags in the Jest globals, which clash with Vitest's.
// These two exports are all the tests use.
declare module 'jest-axe' {
  import type { AxeResults, RunOptions } from 'axe-core'

  export function axe(html: Element | string, options?: RunOptions): Promise<AxeResults>
  export const toHaveNoViolations: {
    toHaveNoViolations(results: AxeResults): { pass: boolean; message(): string }
  }
}
