import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { collectRuntimeErrors, expectNoRuntimeErrors } from './helpers.js';
const definition = JSON.parse(readFileSync(new URL('../../data/tests/hydrocarbons.json', import.meta.url)));
const questions = new Map(definition.questions.map(q => [q.id, q]));
const key = 'chem-cabinet:progress:hydrocarbons';

test.beforeEach(async ({ page }) => {
  await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }));
});

async function progress(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
}
async function answerCorrectly(page, question, override) {
  if (question.type === 'chemical') await page.locator('.text-answer-input').fill(override ?? question.correct[0]);
  else if (question.type === 'matching') {
    for (const item of question.items) await page.locator(`#matching-${question.id}-${item.id}`).selectOption(question.correct[item.id]);
  } else {
    for (const index of question.correct) {
      const input = page.locator(`input[name="answer-${question.id}"][value="${index}"]`);
      if (!await input.isChecked()) await input.locator('..').click();
    }
  }
}
async function openQuestion(page, question, variantId = 'name') {
  const variant = definition.variants.find(v => v.id === variantId);
  await page.goto('/index.html');
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {key,value:{
    schemaVersion:1,testId:definition.id,testVersion:definition.version,attemptId:`smoke-${question.id}`,
    variantId,mode:'training',baseQuestionIds:variant.questionIds,questionOrder:[question.id],questionIds:[question.id],
    currentQuestionId:question.id,selectedAnswers:{},optionOrder:{[question.id]:question.type === 'matching'?question.options.map(o=>o.id):question.options?.map((_,i)=>i)||[]},
    checkedQuestionIds:[],mistakeQuestionIds:[],startedAt:'2026-11-08T10:00:00.000Z',retryOf:null
  }});
  await page.goto('/test.html?id=hydrocarbons');
  await page.locator('#resumeButton').click();
  await expect(page.locator('#workPanel')).toBeVisible();
}

test('тест использует общий интерфейс, старый адрес ведёт на него, теория и карточки сохранены', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/hydrocarbons.html');
  await expect(page).toHaveURL(/\/test\.html\?id=hydrocarbons$/);
  await expect(page.locator('.site-header .site-brand')).toBeVisible();
  await expect(page.locator('#heroTitle')).toHaveText(definition.title);
  await expect(page.locator('input[name="test-variant"]')).toHaveCount(22);
  await expect(page.locator('.trainer-variant-group')).toHaveCount(4);
  await expect(page.locator('#studyMaterials .study-topic')).toHaveCount(4);
  await expect(page.locator('.study-card')).toHaveCount(36);
  await page.locator('#studyMaterials .study-topic > summary').first().click();
  await page.locator('.study-card > summary').first().click();
  await expect(page.locator('.study-card[open] > strong')).toBeVisible();
  await expect(page.locator('#historyLink')).toHaveAttribute('href','results.html?id=hydrocarbons');
  await expectNoRuntimeErrors(errors);
});

test('все тематические этапы запускаются через общий выбор вариантов', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = collectRuntimeErrors(page);
  for (const variant of definition.variants.filter(v=>v.group)) {
    await page.goto('/test.html?id=hydrocarbons');
    const input = page.locator(`input[name="test-variant"][value="${variant.id}"]`);
    await input.evaluate(input => { input.closest('details').open = true; });
    await input.check({ force: true });
    await page.locator('#startAttemptButton').click();
    await expect(page.locator('#activeVariantBadge')).toHaveText(variant.title);
    const stored = await progress(page);
    expect(stored.questionOrder.length).toBe(variant.selectionCount.training);
  }
  await expectNoRuntimeErrors(errors);
});

test('структурная формула имеет предпросмотр, увеличивается, сохраняется и принимает обратную запись цепи', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  const question = definition.questions.find(q => q.chemical?.kind==='structure' && q.correct[0]==='CH#C-CH2-CH2-CH3');
  expect(question).toBeTruthy();
  await openQuestion(page, question);
  const answer = 'CH₃–CH₂–CH₂–C≡CH';
  await page.locator('.text-answer-input').fill(answer);
  await expect(page.locator('.chemical-preview svg')).toBeVisible();
  await page.locator('.chemical-preview .chemical-zoom-button').click();
  await expect(page.locator('dialog[open]')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload(); await page.locator('#resumeButton').click();
  await expect(page.locator('.text-answer-input')).toHaveValue(answer);
  await page.locator('#primaryButton').click();
  await expect(page.locator('#feedbackPanel')).toContainText('✓ Верно');
  await page.locator('#primaryButton').click();
  await expect(page.locator('#resultScore')).toHaveText('1/1');
  await page.locator('#resultHistoryLink').click();
  await expect(page.locator('body')).toContainText('100%');
  await expectNoRuntimeErrors(errors);
});

test('название с современным положением локанта принимается, другой изомер попадает в работу над ошибками', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  const name = definition.questions.find(q=>q.chemical?.kind==='name' && q.correct[0].toLowerCase()==='пентен-2');
  await openQuestion(page,name); await page.locator('.text-answer-input').fill('пент-2-ен');
  await page.locator('#primaryButton').click();
  await expect(page.locator('#feedbackPanel')).toContainText('✓ Верно');
  const formula = definition.questions.find(q=>q.chemical?.kind==='structure' && q.correct[0]==='CH3-CH=CH-CH2-CH3');
  await openQuestion(page,formula); await page.locator('.text-answer-input').fill('CH2=CH-CH2-CH2-CH3');
  await page.locator('#primaryButton').click(); await expect(page.locator('#feedbackPanel')).toHaveClass(/is-wrong/);
  await page.locator('#primaryButton').click(); await expect(page.locator('#resultScore')).toHaveText('0/1');
  await page.locator('#repeatMistakesButton').click();
  expect((await progress(page)).questionOrder).toEqual([formula.id]);
  await answerCorrectly(page,formula); await page.locator('#primaryButton').click();
  await expect(page.locator('#feedbackPanel')).toContainText('✓ Верно');
  await expectNoRuntimeErrors(errors);
});

test('общая контрольная сохраняет выборку и ответы, не раскрывает проверку и завершается на 39 баллов', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = collectRuntimeErrors(page);
  await page.goto('/test.html?id=hydrocarbons');
  await page.locator('input[name="test-mode"][value="test"]').check({ force: true });
  await page.locator('#startAttemptButton').click();
  const stored = await progress(page);
  expect(stored.questionOrder).toHaveLength(24);
  for (const section of definition.sections) expect(stored.questionOrder.filter(id=>questions.get(id).section===section.id)).toHaveLength(6);
  await answerCorrectly(page,questions.get(stored.questionOrder[0]));
  await expect(page.locator('#feedbackPanel')).toBeHidden();
  const before = await progress(page);
  await page.reload(); await page.locator('#resumeButton').click();
  const restored = await progress(page);
  expect(restored.questionOrder).toEqual(before.questionOrder); expect(restored.selectedAnswers).toEqual(before.selectedAnswers);
  for (const id of stored.questionOrder) {
    await answerCorrectly(page, questions.get(id));
    await expect(page.locator('#feedbackPanel')).toBeHidden();
    await page.locator('#primaryButton').click();
  }
  await expect(page.locator('#resultPanel')).toBeVisible();
  await expect(page.locator('#resultScore')).toHaveText('39/39');
  await expect(page.locator('#resultPercent')).toHaveText('100%');
  await expect(page.locator('#reviewContainer .trainer-review-item')).toHaveCount(24);
  await expectNoRuntimeErrors(errors);
});

test('условия, варианты с рисунками и сопоставления помещаются на экране 360 px', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({width:360,height:800});
  const targets = [
    definition.questions.find(q=>Array.isArray(q.content) && q.content.some(p=>p.format==='structure')),
    definition.questions.find(q=>q.optionFormats?.includes('structure')),
    definition.questions.find(q=>q.type==='matching' && q.items.some(i=>i.format==='structure')),
    definition.questions.find(q=>q.type==='matching' && q.options.some(i=>i.format==='structure'))
  ].filter(Boolean);
  for (const question of targets) {
    const variant = definition.variants.find(v=>v.questionIds.includes(question.id));
    await openQuestion(page,question,variant.id);
    const overflow = await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.locator('#workPanel .chemical-diagram svg').first()).toBeVisible();
    await page.locator('#workPanel .chemical-zoom-button').first().click();
    await expect(page.locator('dialog[open]')).toBeVisible(); await page.keyboard.press('Escape');
  }
  await expectNoRuntimeErrors(errors);
});

test('резервный каталог без JavaScript ведёт на каноническую страницу теста', async ({ browser }) => {
  const context = await browser.newContext({javaScriptEnabled:false});
  const page = await context.newPage(); await page.goto('/index.html');
  await expect(page.locator('#organic a[href="test.html?id=hydrocarbons"]')).toBeVisible(); await context.close();
});

test('тест и все его варианты доступны в общей форме назначения работы учителем', async ({ page }) => {
  const mock = readFileSync(new URL('./fixtures/supabase-client.mock.js', import.meta.url), 'utf8');
  await page.route(/\/assets\/js\/supabase-client\.js\?v=\d+$/, route => route.fulfill({
    contentType:'text/javascript; charset=utf-8',body:mock.replaceAll('__ROLE__','teacher')
  }));
  await page.goto('/dashboard.html');
  await expect(page.locator('#teacherPanel')).toBeVisible();
  await page.locator('#assignmentTest').selectOption('hydrocarbons');
  await expect(page.locator('#assignmentVariant option')).toHaveCount(22);
  await expect(page.locator('#assignmentMode option')).toHaveCount(2);
});
