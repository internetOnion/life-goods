import { expect, test } from '@playwright/test'


test('invalid input stays in the browser and valid no-match crosses the API boundary', async ({ page }) => {
  let packageMatchRequests = 0
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/package-matches')) packageMatchRequests += 1
  })

  await page.goto('/')
  const input = page.getByRole('textbox', { name: 'លេខបាកូដ' })
  await input.fill('1234')
  await page.getByRole('button', { name: 'ពិនិត្យបាកូដ' }).click()

  await expect(input).toHaveAttribute('aria-invalid', 'true')
  expect(packageMatchRequests).toBe(0)

  await input.fill('4 006381 333931')
  await page.getByRole('button', { name: 'ពិនិត្យបាកូដ' }).click()

  await expect(page.getByRole('heading', { name: 'រកមិនឃើញព័ត៌មានកញ្ចប់' })).toBeVisible()
  await expect(page.getByText('4006381333931')).toBeVisible()
  expect(packageMatchRequests).toBe(1)
})

test('keyboard order, Khmer layout, announcements, and reduced motion remain usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'ខ្មែរ' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'English' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('textbox', { name: 'លេខបាកូដ' })).toBeFocused()
  await page.keyboard.type('4006381333931')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'ពិនិត្យបាកូដ' })).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('status')).toContainText('រកមិនឃើញព័ត៌មានកញ្ចប់')
  const outcome = page.locator('.outcome')
  await expect(outcome).toBeVisible()
  expect(await outcome.evaluate((element) => parseFloat(getComputedStyle(element).animationDuration))).toBeLessThanOrEqual(0.001)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  )
})
