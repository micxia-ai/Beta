import { test, expect } from '@playwright/test';

test('manage all databases, calculate monthly payouts, record withdrawals, and export', async ({page}) => {
  const errors: string[] = [];page.on('pageerror',e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Commission overview'})).toBeVisible();
  for (const [nav,entity,name] of [['Investors','investor','Test Investor'],['Agents','agent','Test Agent'],['Overriding managers','overriding manager','Test Manager']]) {
    await page.getByRole('navigation').getByRole('button',{name:nav,exact:true}).click();
    await page.getByRole('button',{name:'Add '+entity,exact:true}).first().click();
    await page.getByLabel('Full name').fill(name);await page.getByLabel('Email address').fill(entity.split(' ')[0]+'@example.com');
    await page.getByRole('button',{name:'Create '+entity,exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('cell',{name,exact:false}).first()).toBeVisible();
  }
  await page.getByRole('navigation').getByRole('button',{name:'Investments',exact:false}).click();
  await page.getByRole('button',{name:'Add investment',exact:true}).click();
  await page.getByLabel('Investment name').fill('Test Growth Fund');
  await page.getByRole('combobox',{name:'Investor',exact:true}).selectOption({label:'Test Investor'});
  await page.getByLabel('Investment amount (USD)').fill('120000');await page.getByLabel('Start date').fill('2026-01-01');
  await page.getByRole('combobox',{name:'Agent',exact:true}).selectOption({label:'Test Agent'});await page.getByLabel('Agent annual rate (%)').fill('1.2');
  await page.getByRole('combobox',{name:'Overriding manager',exact:true}).selectOption({label:'Test Manager'});await page.getByLabel('Manager annual override (%)').fill('0.24');
  await page.getByRole('button',{name:'Create investment',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Reporting month').fill('2026-01');
  const row=page.getByRole('row').filter({hasText:'Test Growth Fund'});await expect(row).toContainText('$144.00');
  await page.getByRole('button',{name:'View Test Growth Fund',exact:true}).click();
  await page.getByRole('button',{name:'Record withdrawal',exact:true}).click();
  await page.getByLabel('Withdrawal date',{exact:true}).fill('2026-01-15');await page.getByLabel('Withdrawal amount',{exact:true}).fill('60000');
  await page.getByRole('button',{name:'Save & recalculate'}).click();await expect(page.locator('.calculation-title')).toContainText('$106.84');
  await expect(page.locator('.calculation-box')).toContainText('$89,032.26');
  await page.getByRole('button',{name:'Edit investment',exact:true}).click();await page.getByLabel('Agent annual rate (%)').fill('2.4');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.locator('.calculation-title')).toContainText('$195.87');
  await page.getByRole('button',{name:'Close dialog'}).click();await page.reload();await page.getByLabel('Reporting month').fill('2026-01');
  await expect(page.getByRole('row').filter({hasText:'Test Growth Fund'})).toContainText('$195.87');
  await page.getByRole('navigation').getByRole('button',{name:'Monthly ledger',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export report'}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe('trailbook-2026-01.csv');
  await page.getByRole('navigation').getByRole('button',{name:'Investments',exact:false}).click();
  await page.getByRole('button',{name:'View Test Growth Fund',exact:true}).click();await page.getByRole('button',{name:'Edit investment',exact:true}).click();
  await page.getByRole('button',{name:'Lump-sum A single upfront payment'}).click();await page.getByLabel('Agent one-time rate (%)').fill('2');await page.getByLabel('Manager one-time override (%)').fill('.5');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.locator('.calculation-title')).toContainText('$3,000.00');
  await page.getByRole('button',{name:'Close dialog'}).click();await page.getByLabel('Reporting month').fill('2026-02');await expect(page.getByRole('row').filter({hasText:'Test Growth Fund'})).toContainText('$0.00');
  await page.getByRole('button',{name:'View Test Growth Fund',exact:true}).click();page.once('dialog',d => d.accept());
  await page.getByRole('button',{name:'Delete investment',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('heading',{name:'No investments found'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile navigation, modal accessibility, and layout',async ({page}) => {
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await expect(page.getByRole('heading',{name:'Commission overview'})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('navigation').getByRole('button',{name:'Investors',exact:true}).click();
  await page.getByRole('button',{name:'Add investor',exact:true}).first().click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
