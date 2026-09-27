import { expect, type Locator, type Page, test } from '@playwright/test';

// M7 #309: the new-task dialog's 添加标签 affordance joins the wire —
// footer dashed circle → 448-family tag panel (pill toggle + inline
// create form, r9 §2.5/§3.4) → footer selected chips. The fixture face
// carries no tag data source, so the panel's empty list + create entry
// reproduces the r9 93 initial state; created tags land in dialog-local
// state (the live face posts /api/projects/{id}/tags — covered by the
// integration e2e). Calibration (spec 08 附录 A, r9 §3.4): board cards do
// NOT render tags, so no card-face assertion lives here.
// Each test pins one failure mode:
// 1. tag-add stays a dead button (no panel)
// 2. the create entry lacks the inline form / save doesn't select
// 3. pill click doesn't toggle
// 4. the footer misses the selected chips after the panel closes
// 5. Esc peels the whole dialog instead of the panel layer first
// 6. retained mount: reopening carries the previous selection

const BOARD = '/app?scenario=01';

async function openPanel(page: Page) {
  await page.goto(BOARD);
  await page.locator('.board-new-task').click();
  const dialog = page.locator('.new-task-dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('.new-task-tag-add').click();
  const panel = page.locator('.new-task-tag-panel');
  await expect(panel).toBeVisible();
  return { dialog, panel };
}

async function createTag(panel: Locator, name: string) {
  await panel.locator('.new-task-tag-new').click();
  const input = panel.locator('.new-task-tag-input');
  await expect(input).toBeVisible();
  await input.fill(name);
  await panel.locator('.new-task-tag-save').click();
}

test('the tag-add button opens the tag panel with the empty-list create entry', async ({
  page,
}) => {
  const { panel } = await openPanel(page);
  await expect(panel.locator('.dlg-title')).toHaveText('标签');
  await expect(panel.locator('.new-task-tag-pill')).toHaveCount(0);
  await expect(panel.locator('.new-task-tag-new')).toContainText('新建标签');
});

test('inline create: name + save lands the pill in the selected state', async ({ page }) => {
  const { panel } = await openPanel(page);
  await createTag(panel, 'r9probe');
  const pill = panel.locator('.new-task-tag-pill');
  await expect(pill).toHaveCount(1);
  await expect(pill).toHaveText('r9probe');
  await expect(pill).toHaveAttribute('data-on', 'true'); // r9 95: 建后选中态
  await expect(panel.locator('.new-task-tag-input')).toBeHidden();
  // the create entry returns for the next tag
  await expect(panel.locator('.new-task-tag-new')).toBeVisible();
});

test('pill click toggles the selection', async ({ page }) => {
  const { panel } = await openPanel(page);
  await createTag(panel, 'toggle-probe');
  const pill = panel.locator('.new-task-tag-pill');
  await pill.click();
  await expect(pill).toHaveAttribute('data-on', 'false');
  await pill.click();
  await expect(pill).toHaveAttribute('data-on', 'true');
});

test('the footer carries a chip per selected tag once the panel closes', async ({ page }) => {
  const { dialog, panel } = await openPanel(page);
  await createTag(panel, 'chip-probe');
  await panel.locator('.dlg-close').click();
  await expect(panel).toBeHidden();
  const chips = dialog.locator('.new-task-tag-chip');
  await expect(chips).toHaveCount(1);
  await expect(chips.first()).toHaveText('chip-probe');
  // the dashed add button rides after the chips (r9 96)
  await expect(dialog.locator('.new-task-tag-add')).toBeVisible();

  // deselect all → the footer falls back to the 标签 text row
  await dialog.locator('.new-task-tag-add').click();
  await panel.locator('.new-task-tag-pill').click();
  await panel.locator('.dlg-close').click();
  await expect(chips).toHaveCount(0);
  await expect(dialog.locator('.new-task-tags')).toContainText('标签');
});

test('Escape closes the panel layer first, then the dialog', async ({ page }) => {
  const { dialog, panel } = await openPanel(page);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('reopening the dialog does not carry the previous selection', async ({ page }) => {
  const { dialog, panel } = await openPanel(page);
  await createTag(panel, 'stale-probe');
  await panel.locator('.dlg-close').click();
  await expect(dialog.locator('.new-task-tag-chip')).toHaveCount(1);
  // close via the dialog's own Esc, then reopen (retained mount — #176 law:
  // 重开不得带回开态)
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.locator('.board-new-task').click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.new-task-tag-chip')).toHaveCount(0);
  await dialog.locator('.new-task-tag-add').click();
  await expect(panel.locator('.new-task-tag-pill')).toHaveCount(0);
});
