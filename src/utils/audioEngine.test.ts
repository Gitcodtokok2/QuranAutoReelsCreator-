import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGaplessAudioPlan, trimSilenceBounds } from './audioEngine';

test('trimSilenceBounds strips leading and trailing dead air while keeping natural padding', () => {
  const sampleRate = 1000; // 1ms per sample for crisp testing
  const samples = new Float32Array(1000);
  // Loud speech between 300ms and 700ms
  for (let i = 300; i <= 700; i++) {
    samples[i] = 0.25;
  }

  const bounds = trimSilenceBounds(samples, sampleRate, 0.01, 0.04, 0.1);
  assert.equal(bounds.startSample, 260); // 300 - 40ms lead
  assert.equal(bounds.endSample, 800); // 700 + 100ms tail
});

test('trimSilenceBounds preserves silent buffer intact rather than returning empty range', () => {
  const samples = new Float32Array(500);
  const bounds = trimSilenceBounds(samples, 1000, 0.01);
  assert.equal(bounds.startSample, 0);
  assert.equal(bounds.endSample, 500);
});

test('buildGaplessAudioPlan creates continuous back-to-back verse boundaries with crossfade overlap', () => {
  const plan = buildGaplessAudioPlan([4.0, 5.0, 3.5], 0.1);
  assert.equal(plan.segments.length, 3);
  assert.equal(plan.segments[0].startTime, 0);
  assert.equal(plan.segments[0].endTime, 3.9);
  assert.equal(plan.segments[1].startTime, 3.9);
  assert.equal(plan.segments[1].endTime, 8.8);
  assert.equal(plan.segments[2].startTime, 8.8);
  assert.equal(plan.segments[2].endTime, 12.3);
  assert.equal(Number(plan.totalDuration.toFixed(2)), 12.3);
});
