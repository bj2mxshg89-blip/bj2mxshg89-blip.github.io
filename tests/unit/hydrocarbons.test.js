import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseChemicalStructure, chemicalStructureKey, normalizeChemicalName } from '../../assets/js/chemical-structures.js';
import { evaluateAnswer, normalizeAnswer } from '../../assets/js/question-types.js';
import { validateTestDefinition } from '../../assets/js/utils.js';
import { createAttemptQuestionOrder } from '../../assets/js/attempt-selection.js';
import { validateTestContent } from '../../scripts/lib/data-validation.mjs';
import { attemptToCloudRow, cloudRowToAttempt } from '../../assets/js/cloud-records.js';
const definition = JSON.parse(readFileSync(new URL('../../data/tests/hydrocarbons.json', import.meta.url)));
const questions = new Map(definition.questions.map(q => [q.id, q]));
const reverse = xs => [...xs].reverse();

test('перенесённый банк полностью валиден; все эталонные ответы принимаются общим реестром', () => {
  assert.deepEqual(validateTestDefinition(definition, 'hydrocarbons').errors, []);
  assert.equal(definition.questions.length, 764);
  assert.equal(definition.variants.length, 22);
  assert.equal(definition.studyMaterials.length, 4);
  assert.equal(definition.studyMaterials.reduce((n, topic) => n + topic.cards.length, 0), 36);
  for (const q of definition.questions) {
    const raw = q.type === 'chemical' ? q.correct[0] : q.correct;
    assert.equal(evaluateAnswer(q, normalizeAnswer(q, raw)).isFullyCorrect, true, q.id);
    assert.equal(evaluateAnswer(q, q.type === 'matching' ? {} : q.type === 'chemical' ? '' : []).earnedPoints, 0, q.id);
  }
});

test('формулы принимаются по графу связей, а разные изомеры различаются', () => {
  for (const [a, b] of [
    ['CH3-CH2-CH=CH2', 'CH2=CH-CH2-CH3'],
    ['CH3-CH(CH3)-CH2-CH3', 'CH3-CH2-CH(CH3)-CH3'],
    ['CH#C-CH2-CH3', 'CH₃–CH₂–C≡CH'],
    ['CH3CH2CH3', 'CH3-CH2-CH3']
  ]) assert.equal(chemicalStructureKey(a), chemicalStructureKey(b));
  assert.notEqual(chemicalStructureKey('CH2=CH-CH2-CH3'), chemicalStructureKey('CH3-CH=CH-CH3'));
  assert.notEqual(chemicalStructureKey('CH3-CH(CH3)-CH3'), chemicalStructureKey('CH3-CH2-CH2-CH3'));
});

test('парсер отвергает молекулярную запись, незавершённые связи, неверную валентность и чрезмерный ввод', () => {
  for (const raw of ['', 'C4H10', 'CH3-', 'CH3--CH3', 'CH3()', 'CH3(CH3', 'CH3=CH3', '<svg onload=alert(1)>', 'CH2-'.repeat(100)]) {
    assert.throws(() => parseChemicalStructure(raw), raw);
  }
});

test('названия поддерживают положение локанта и исходные синонимы без принятия другого вещества', () => {
  assert.equal(normalizeChemicalName('  ПЕНТ-2-ЕН '), normalizeChemicalName('пентен-2'));
  const q = definition.questions.find(q => q.type === 'chemical' && q.correct.includes('изобутан'));
  assert.ok(q);
  assert.equal(evaluateAnswer(q, 'изобутан').isFullyCorrect, true);
  assert.equal(evaluateAnswer(q, 'бутан').isFullyCorrect, false);
  const formula = definition.questions.find(q => q.type === 'chemical' && q.chemical.kind === 'structure');
  assert.equal(evaluateAnswer(formula, 'C4H10').earnedPoints, 0);
});

test('контрольная сохраняет исходные квоты форматов и шесть вопросов из каждого раздела', () => {
  const variant = definition.variants.find(v => v.id === 'mixed');
  for (let seed = 1; seed <= 50; seed++) {
    let state = seed;
    const shuffle = items => [...items].sort(() => { state = (Math.imul(state,1664525)+1013904223) >>> 0; return state / 2**32 - .5; });
    const ids = createAttemptQuestionOrder({ baseQuestionIds: variant.questionIds, selectionGroups: variant.selectionGroups, selectionCount: 24, shuffleQuestions: true }, shuffle);
    assert.equal(ids.length, 24);
    assert.equal(new Set(ids).size, 24);
    for (const topic of definition.sections) assert.equal(ids.filter(id => questions.get(id).section === topic.id).length, 6);
    assert.equal(ids.filter(id => questions.get(id).type === 'matching').length, 5);
    assert.equal(ids.filter(id => questions.get(id).chemical?.kind === 'name').length, 3);
    assert.equal(ids.filter(id => questions.get(id).chemical?.kind === 'structure').length, 3);
  }
  const report = validateTestContent(definition, definition.id);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.attemptMaximums.filter(v => v.variantId === 'mixed').map(v => [v.questions,v.minimum,v.maximum]), [[24,39,39],[24,39,39]]);
  assert.deepEqual(createAttemptQuestionOrder({ baseQuestionIds: variant.questionIds, selectionGroups: variant.selectionGroups, retryQuestionIds: variant.questionIds.slice(0,3), shuffleQuestions: true }, reverse), variant.questionIds.slice(0,3));
});

test('валидатор запрещает пересечение и неполное покрытие групп, плохие формулы и учебный HTML', () => {
  const clone = () => structuredClone(definition);
  const duplicate = clone(); duplicate.variants[0].selectionGroups[1].questionIds.push(duplicate.variants[0].selectionGroups[0].questionIds[0]);
  assert.match(validateTestDefinition(duplicate).errors.join('\n'), /разные известные вопросы/);
  const incomplete = clone(); incomplete.variants[0].selectionGroups[0].questionIds.pop();
  assert.match(validateTestDefinition(incomplete).errors.join('\n'), /покрывать/);
  const invalid = clone(); invalid.questions.find(q=>q.content?.format==='structure').content.text = 'CH3=CH3';
  assert.match(validateTestDefinition(invalid).errors.join('\n'), /валентность/);
  const html = clone(); html.studyMaterials[0].blocks.push({kind:'html',text:'<script>alert(1)</script>'});
  assert.match(validateTestDefinition(html).errors.join('\n'), /недопустимый блок/);
});

test('химические ответы проходят общий формат сохранения и облачной истории без изменений', () => {
  const q = definition.questions.find(q=>q.chemical?.kind==='structure');
  const entered = q.correct[0].replaceAll('#','≡');
  const attempt = {testId:'hydrocarbons',testVersion:1,attemptId:'hydrocarbons-roundtrip',variantId:'name-stage-3',mode:'training',questionIds:[q.id],selectedAnswers:{[q.id]:entered},mistakeQuestionIds:[],earnedPoints:1,maxPoints:1,correctCount:1,totalQuestions:1,grade:5,percent:100};
  const restored = cloudRowToAttempt(JSON.parse(JSON.stringify(attemptToCloudRow('test-user', attempt))));
  assert.deepEqual(restored.selectedAnswers, attempt.selectedAnswers);
  assert.equal(evaluateAnswer(q, restored.selectedAnswers[q.id]).isFullyCorrect, true);
});
