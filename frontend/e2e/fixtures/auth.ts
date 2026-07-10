import { test as base, type Page, type BrowserContext } from '@playwright/test'
import { STORAGE_STATE } from './test-data'

type AuthFixtures = {
  user1Page: Page
  user2Page: Page
  adminPage: Page
  user1Context: BrowserContext
  user2Context: BrowserContext
}

export const test = base.extend<AuthFixtures>({
  user1Context: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: STORAGE_STATE.user1 })
    await use(ctx)
    await ctx.close()
  },
  user2Context: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: STORAGE_STATE.user2 })
    await use(ctx)
    await ctx.close()
  },
  user1Page: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: STORAGE_STATE.user1 })
    const page = await ctx.newPage()
    await use(page)
    await ctx.close()
  },
  user2Page: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: STORAGE_STATE.user2 })
    const page = await ctx.newPage()
    await use(page)
    await ctx.close()
  },
  adminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: STORAGE_STATE.admin })
    const page = await ctx.newPage()
    await use(page)
    await ctx.close()
  },
})

export { expect } from '@playwright/test'
