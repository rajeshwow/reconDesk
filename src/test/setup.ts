import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'
import { toHaveNoViolations } from 'jest-axe'
import { resetMockDb } from '@/api/mockApi'

expect.extend(toHaveNoViolations)

// Pages are lazy-loaded, and the first import of a page can take a while when the whole
// suite runs in parallel. The 1s default is too tight for that.
configure({ asyncUtilTimeout: 5000 })

afterEach(() => resetMockDb())
