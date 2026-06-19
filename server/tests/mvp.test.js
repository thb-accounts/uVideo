import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectProfanity, normalizeModerationText } from '../src/lib/profanity.js'
import { canPublishPublicly, canUseQuickChat } from '../src/lib/permissions.js'
import { buildApprovedVideoKey, buildPendingVideoKey, buildRejectedVideoKey, cloudfrontUrlForKey } from '../src/lib/storage.js'
import { mapDiditResult } from '../src/lib/didit.js'

test('profanity normalization catches common bypasses', () => {
  assert.equal(normalizeModerationText('fuuuck'), 'fuuck')
  assert.equal(inspectProfanity('sh1t').clean, false)
  assert.equal(inspectProfanity('friendly tutorial').clean, true)
})

test('permission checks gate quick chat and public publishing at verified 15+', () => {
  assert.equal(canUseQuickChat({ verificationStatus: 'unverified' }), false)
  assert.equal(canPublishPublicly({ verificationStatus: 'verified_15_plus' }), true)
  assert.equal(canUseQuickChat({ verificationStatus: 'verified_18_plus' }), true)
})

test('S3 key builders use required UVideo bucket layout', () => {
  assert.equal(buildPendingVideoKey('user1', 'video1', '.mp4'), 'pending/user1/video1.mp4')
  assert.equal(buildApprovedVideoKey('video1', 'mov'), 'approved/video1.mov')
  assert.equal(buildRejectedVideoKey('video1', 'mp4'), 'rejected/video1.mp4')
})

test('CloudFront URLs are generated without exposing raw S3 URLs', () => {
  process.env.CLOUDFRONT_BASE_URL = 'https://cdn.example.test/'
  assert.equal(cloudfrontUrlForKey('approved/video1.mp4'), 'https://cdn.example.test/approved/video1.mp4')
})

test('Didit result mapping stores only coarse verification state', () => {
  assert.equal(mapDiditResult({ ageRange: '18+', rawIdentity: { passport: 'do-not-store' } }), 'verified_18_plus')
  assert.equal(mapDiditResult({ passed: true, threshold: 15, dateOfBirth: '2001-01-01' }), 'verified_15_plus')
  assert.equal(mapDiditResult({ passed: false, threshold: 15 }), null)
})
