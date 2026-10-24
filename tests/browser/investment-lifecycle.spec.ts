import { test, expect } from "@playwright/test";

test("saved CAD investment exposes compounding, renewed commissions, cash distributions, and current balance", async ({
  page,
  request,
}) => {
  const investor = await (
    await request.post("/api/investors", {
      data: { name: "Lifecycle Investor" },
    })
  ).json();
  const agent = await (
    await request.post("/api/agents", { data: { name: "Lifecycle Agent" } })
  ).json();
  let investmentId = "";
  try {
    await page.goto("/#investments");
    await page
      .getByRole("button", { name: "Add investment", exact: true })
      .click();
    await page.getByLabel("Investment name").fill("CAD Monthly DRIP");
    await page
      .getByRole("combobox", { name: "Investor", exact: true })
      .selectOption(investor.id);
    await page
      .getByRole("combobox", { name: "Agent", exact: true })
      .selectOption(agent.id);
    await page
      .getByLabel("Investment currency", { exact: true })
      .selectOption("CAD");
    await page.getByLabel("Investment amount (CAD)").fill("120000");
    await page.getByLabel("Start date", { exact: true }).fill("2026-01-01");
    await page
      .getByLabel("Annual investment return (%)", { exact: true })
      .fill("12");
    await page
      .getByRole("button", { name: "DRIP Reinvest & compound monthly" })
      .click();
    await page
      .getByLabel("Investment term (months)", { exact: true })
      .fill("1");
    await expect(page.getByLabel("Maturity date", { exact: true })).toHaveValue(
      "2026-01-31",
    );
    await page
      .getByLabel("Renew automatically at maturity", { exact: true })
      .check();
    await page.getByLabel("Agent upfront rate (%)", { exact: true }).fill("2");
    await page
      .getByRole("button", { name: "Create investment", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByLabel("Report currency", { exact: true }),
    ).toHaveValue("CAD");
    await page.getByLabel("Reporting month", { exact: true }).fill("2026-02");
    const row = page.getByRole("row").filter({ hasText: "CAD Monthly DRIP" });
    await expect(row).toContainText("CA$2,545.20");
    await expect(row).toContainText("12% annual");
    await expect(row).toContainText("Upfront + trailer");
    const state = await (await request.get("/api/state")).json();
    investmentId = state.investments.find(
      (i: { name: string }) => i.name === "CAD Monthly DRIP",
    ).id;
    await page
      .getByRole("button", { name: "View CAD Monthly DRIP", exact: true })
      .click();
    await expect(page.getByTestId("current-investment-balance")).toContainText(
      "CA$",
    );
    await expect(page.locator(".calculation-box")).toContainText("CA$2,424.00");
    await expect(page.locator(".renewal-events")).toContainText("Renewal");
    const distribution = page
      .getByRole("table", { name: "Monthly returns and distributions" })
      .getByRole("row")
      .filter({ hasText: "Feb 2026" });
    await expect(distribution).toContainText("CA$1,212.00");
    await expect(distribution).toContainText("CA$122,412.00");
    await page
      .getByRole("button", { name: "Edit investment", exact: true })
      .click();
    await expect(
      page.getByLabel("Renew automatically at maturity", { exact: true }),
    ).toBeChecked();
    await page
      .getByRole("button", {
        name: "Cash Dividend Payout Pay returns without reinvesting",
      })
      .click();
    await page
      .getByLabel("Renew automatically at maturity", { exact: true })
      .uncheck();
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.locator(".calculation-title")).toContainText("CA$0.00");
    await expect(page.getByTestId("current-investment-balance")).toHaveText(
      "CA$120,000.00",
    );
    const jan = page
      .getByRole("table", { name: "Monthly returns and distributions" })
      .getByRole("row")
      .filter({ hasText: "Jan 2026" });
    await expect(jan).toContainText("CA$1,200.00");
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await expect(row).toContainText("Matured");
    await page
      .getByLabel("Report currency", { exact: true })
      .selectOption("USD");
    await expect(
      page.getByRole("button", { name: "View CAD Monthly DRIP", exact: true }),
    ).toHaveCount(0);
    await page
      .getByLabel("Report currency", { exact: true })
      .selectOption("CAD");
    await expect(
      page.getByRole("button", { name: "View CAD Monthly DRIP", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByLabel("Report currency", { exact: true }),
    ).toHaveValue("CAD");
    await expect(
      page.getByRole("button", { name: "View CAD Monthly DRIP", exact: true }),
    ).toBeVisible();
  } finally {
    if (!investmentId) {
      const state = await (await request.get("/api/state")).json();
      investmentId =
        state.investments.find(
          (i: { name: string }) => i.name === "CAD Monthly DRIP",
        )?.id || "";
    }
    if (investmentId) await request.delete("/api/investments/" + investmentId);
    await request.delete("/api/investors/" + investor.id);
    await request.delete("/api/agents/" + agent.id);
  }
});

test("calculator models CAD DRIP with upfront plus trailer and term renewals", async ({
  page,
}) => {
  await page.goto("/#calculator");
  await page
    .getByLabel("Scenario start date", { exact: true })
    .fill("2026-01-01");
  await page
    .getByLabel("Scenario reporting month", { exact: true })
    .fill("2026-02");
  await page
    .getByLabel("Investment currency", { exact: true })
    .selectOption("CAD");
  await page
    .getByLabel("Annual investment return (%)", { exact: true })
    .fill("12");
  await page
    .getByRole("button", { name: "DRIP Reinvest & compound monthly" })
    .click();
  await page.getByLabel("Investment term (months)", { exact: true }).fill("1");
  await page
    .getByLabel("Renew automatically at maturity", { exact: true })
    .check();
  await page.getByLabel("Agent upfront rate (%)", { exact: true }).fill("2");
  await page
    .getByLabel("Manager upfront override (%)", { exact: true })
    .fill(".5");
  await page
    .getByRole("button", { name: "Calculate commission", exact: true })
    .click();
  await expect(page.getByTestId("scenario-total")).toHaveText("CA$3,175.44");
  await expect(page.getByTestId("scenario-average")).toHaveText(
    "CA$121,200.00",
  );
  await expect(page.locator(".scenario-formula")).toContainText("CA$2,424.00");
  await expect(page.locator(".scenario-formula")).toContainText("1 renewals");
  await page.getByRole("button", { name: "Lump-sum One upfront payout" }).click();
  await page.getByLabel("Scenario agent rate", { exact: true }).fill("0");
  await page.getByLabel("Scenario manager rate", { exact: true }).fill(".5");
  await page.getByRole("button", { name: "Calculate commission", exact: true }).click();
  await expect(page.getByTestId("scenario-total")).toHaveText("CA$606.00");
  await expect(page.locator(".scenario-formula")).toContainText("CA$121,200.00");
  await expect(page.locator(".scenario-formula")).not.toContainText("No term starts");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
