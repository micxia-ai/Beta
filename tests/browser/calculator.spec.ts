import { test, expect } from "@playwright/test";
test("standalone calculator supports date scenarios, recalculation, exports, and direct links", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#calculator");
  await expect(
    page.getByRole("heading", { name: "Calculator", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Scenario start date", { exact: true })
    .fill("2026-01-01");
  await page
    .getByLabel("Scenario reporting month", { exact: true })
    .fill("2026-01");
  await page
    .getByRole("button", { name: "Calculate commission", exact: true })
    .click();
  await expect(page.getByTestId("scenario-total")).toHaveText("$144.00");
  await page
    .getByRole("button", { name: "Add a withdrawal", exact: true })
    .click();
  await page
    .getByLabel("Scenario withdrawal date 1", { exact: true })
    .fill("2026-01-15");
  await page
    .getByLabel("Scenario withdrawal amount 1", { exact: true })
    .fill("60000");
  await expect(page.getByRole("status")).toContainText("Inputs changed");
  await expect(
    page.getByRole("button", { name: "Export scenario" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Calculate commission", exact: true })
    .click();
  await expect(page.getByTestId("scenario-total")).toHaveText("$106.84");
  await expect(page.getByTestId("scenario-average")).toHaveText("$89,032.26");
  await page.getByLabel("Include a manager override").uncheck();
  await page
    .getByRole("button", { name: "Calculate commission", exact: true })
    .click();
  await expect(page.getByTestId("scenario-total")).toHaveText("$89.03");
  await expect(page.getByTestId("scenario-manager")).toHaveText("$0.00");
  await page
    .getByRole("button", { name: "Lump-sum One upfront payout" })
    .click();
  await page.getByLabel("Scenario agent rate", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "Calculate commission", exact: true })
    .click();
  await expect(page.getByTestId("scenario-total")).toHaveText("$2,400.00");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export scenario" }).click();
  expect((await pending).suggestedFilename()).toBe(
    "trailbook-scenario-2026-01.csv",
  );
  await page
    .getByLabel("Scenario reporting month", { exact: true })
    .fill("2026-02");
  await page
    .getByRole("button", { name: "Calculate commission", exact: true })
    .click();
  await expect(page.getByTestId("scenario-total")).toHaveText("$0.00");
  await expect(page.locator(".scenario-formula")).toContainText(
    "only in the investment start month",
  );
  await page
    .getByLabel("Scenario withdrawal amount 1", { exact: true })
    .fill("120001");
  await page
    .getByRole("button", { name: "Calculate commission", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("exceeds the available");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByTestId("scenario-total")).toHaveText("$144.00");
  await expect(
    page.getByLabel("Scenario withdrawal date 1", { exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Calculator", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("calculator mobile form and result fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#calculator");
  await expect(page.getByTestId("scenario-total")).toHaveText("$144.00");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Calculate commission", exact: true }),
  ).toBeEnabled();
});
