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
