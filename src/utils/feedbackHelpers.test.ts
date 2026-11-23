import assert from 'node:assert/strict';
import test from 'node:test';
import type { SiteFeedbackItem } from '../types/tilawa';
import {
  clampRatingScore,
  computeFeedbackSummary,
  formatArabicDecimalScore,
  getFeedbackCategoryLabel,
  sortFeedbackForDisplay,
  validateAndSanitizeFeedbackInput,
} from './feedbackHelpers';

test('validateAndSanitizeFeedbackInput enforces comment bounds and defaults author name', () => {
  const invalidShort = validateAndSanitizeFeedbackInput({ comment: '   أ  ', overallRating: 5 });
  assert.equal(invalidShort.ok, false);

  const valid = validateAndSanitizeFeedbackInput({
    authorName: '   ',
    overallRating: 9,
    speedScore: 4,
    designScore: 5,
    audioScore: 0,
    category: 'audio',
    comment: '  الموقع   سريع جدًا   والصوت نقي  ',
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.data.authorName, 'زائر منصة تلاوة');
    assert.equal(valid.data.overallRating, 5);
    assert.equal(valid.data.audioScore, 1);
    assert.equal(valid.data.speedScore, 4);
    assert.equal(valid.data.category, 'audio');
    assert.equal(valid.data.comment, 'الموقع سريع جدًا والصوت نقي');
  }
});

test('computeFeedbackSummary aggregates only visible reviews accurately', () => {
  const items: SiteFeedbackItem[] = [
    {
      id: 'fb_1',
      authorName: 'أحمد',
      overallRating: 5,
      speedScore: 5,
      designScore: 5,
      audioScore: 5,
      category: 'general',
      comment: 'ممتاز ومرتب',
      visible: true,
      createdAt: '2026-11-22T01:00:00.000Z',
    },
    {
      id: 'fb_2',
      authorName: 'سارة',
      overallRating: 3,
      speedScore: 4,
      designScore: 5,
      audioScore: 3,
      category: 'mushaf',
      comment: 'المصحف مريح لكن نحتاج تكبير أسرع',
      visible: true,
      pinned: true,
      createdAt: '2026-11-22T00:30:00.000Z',
    },
    {
      id: 'fb_hidden',
      authorName: 'مخفي',
      overallRating: 1,
      speedScore: 1,
      designScore: 1,
      audioScore: 1,
      category: 'general',
      comment: 'تعليق مخفي لا يحتسب بالمتوسط العام',
      visible: false,
      createdAt: '2026-11-22T02:00:00.000Z',
    },
  ];

  const summary = computeFeedbackSummary(items);
  assert.equal(summary.totalCount, 3);
  assert.equal(summary.visibleCount, 2);
  assert.equal(summary.averageOverall, 4);
  assert.equal(summary.averageSpeed, 4.5);
  assert.equal(summary.averageDesign, 5);
  assert.equal(summary.ratingDistribution[5], 1);
  assert.equal(summary.ratingDistribution[3], 1);

  const sorted = sortFeedbackForDisplay(items.filter((i) => i.visible));
  assert.equal(sorted[0].id, 'fb_2');
  assert.equal(clampRatingScore('4.2', 5), 4);
  assert.equal(getFeedbackCategoryLabel('basira'), 'بودكاست بصيرة والدعاة');
  assert.equal(formatArabicDecimalScore(4.5), '٤٫٥');
  assert.equal(formatArabicDecimalScore(5), '٥٫٠');
});
