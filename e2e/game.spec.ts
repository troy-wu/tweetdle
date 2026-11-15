import { expect, test, type Page } from "@playwright/test";

// Sample puzzle #1 (content/fixtures): the answer is Ada Mockwell.
// The clock is pinned to launch day so the browser always asks for puzzle #1.
const WRONG = ["Nina Null", "Rex Fixture", "DJ Lorem", "Betty Beta", "Max Margin"];

async function open(page: Page) {
  await page.clock.setFixedTime(new Date("2026-11-15T12:00:00"));
  await page.goto("/play");
  await expect(page.getByText("Tweet 1", { exact: false }).first()).toBeVisible();
}

async function guess(page: Page, name: string) {
  const input = page.getByRole("combobox", { name: "Guess who tweeted this" });
  await input.fill(name);
  await page.getByRole("option", { name }).click();
  await page.getByRole("button", { name: "Guess", exact: true }).click();
}

test("home page links to the game", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Play", exact: true }).click();
  await expect(page).toHaveURL(/\/play/);
});

test("win on the first guess scores 100", async ({ page }) => {
  await open(page);
  await guess(page, "Ada Mockwell");
  await expect(page.getByText("Ada Mockwell")).toBeVisible();
  await expect(page.getByText("1/5")).toBeVisible();
  await expect(page.getByText("100", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveCount(0);
});

test("wrong guesses reveal tweets and hints, then a win on guess 4", async ({ page }) => {
  await open(page);
  await expect(page.getByText("Tweet 2", { exact: false })).toHaveCount(0);
  // Dates show from the start; clues only after a wrong guess.
  await expect(page.getByText("Mar 4, 2012")).toBeVisible();
  await expect(page.getByText("Tech", { exact: true })).toHaveCount(0);
  await guess(page, WRONG[0]);
  await expect(page.getByText("Tweet 2", { exact: false }).first()).toBeVisible();
  await expect(page.getByLabel("Wrong guesses").getByText(WRONG[0])).toBeVisible();
  await expect(page.getByText("Tech", { exact: true })).toBeVisible();
  await guess(page, WRONG[1]);
  await expect(page.getByText("Fictional startup founder")).toBeVisible();
  await guess(page, WRONG[2]);
  await guess(page, "Ada Mockwell");
  await expect(page.getByText("4/5")).toBeVisible();
  await expect(page.getByText("40", { exact: true })).toBeVisible();
});

test("five wrong guesses loses and reveals the answer", async ({ page }) => {
  await open(page);
  for (const name of WRONG) await guess(page, name);
  await expect(page.getByText("Ada Mockwell")).toBeVisible();
  await expect(page.getByText("X/5")).toBeVisible();
  await expect(page.getByRole("link", { name: /original/i })).toHaveCount(5);
});

test("an already guessed person is not offered again", async ({ page }) => {
  await open(page);
  await guess(page, WRONG[0]);
  await page.getByRole("combobox").fill("Nina");
  await expect(page.getByRole("option", { name: WRONG[0] })).toHaveCount(0);
});

test("reloading mid-game and after finishing keeps the state", async ({ page }) => {
  await open(page);
  await guess(page, WRONG[0]);
  await guess(page, WRONG[1]);
  await page.reload();
  await expect(page.getByText("Tweet 3", { exact: false }).first()).toBeVisible();
  await expect(page.getByLabel("Wrong guesses").getByText(WRONG[1])).toBeVisible();
  await guess(page, "Ada Mockwell");
  await expect(page.getByText("3/5")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Ada Mockwell")).toBeVisible();
  await expect(page.getByText("3/5")).toBeVisible();
});

test("share copies a spoiler-free result", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    // Force the clipboard path so the test does not open a native share sheet.
    Object.defineProperty(navigator, "share", { value: undefined });
  });
  await open(page);
  await guess(page, WRONG[0]);
  await guess(page, "Ada Mockwell");
  await page.getByRole("button", { name: /share/i }).click();
  await expect(page.getByText(/copied/i)).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("Tweetdle #1 2/5");
  expect(text).toContain("🟥🟩");
  expect(text).not.toContain("Ada");
});

test("leaderboard page renders its tabs", async ({ page }) => {
  await page.goto("/leaderboard");
  await expect(page.getByRole("tab")).toHaveCount(3);
});

test("unlimited mode serves puzzles from its own pool, one after another", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-15T12:00:00"));
  await page.goto("/");
  await page.getByRole("link", { name: "Unlimited mode" }).click();
  await expect(page).toHaveURL(/\/unlimited/);
  await expect(page.getByText("Tweet 1", { exact: false }).first()).toBeVisible();
  // None of these is the answer to either sample unlimited puzzle.
  for (const name of ["Ada Mockwell", "DJ Lorem", "Betty Beta", "Max Margin", "Senator Sample"]) await guess(page, name);
  await expect(page.getByText("Not solved")).toBeVisible();
  await page.getByRole("button", { name: "Next author" }).click();
  await expect(page.getByRole("combobox")).toBeVisible();
  await expect(page.getByText("Tweet 2", { exact: false })).toHaveCount(0);
  // Unlimited games never touch the daily puzzle or the player's stats.
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Play", exact: true })).toBeVisible();
});
