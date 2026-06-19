import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectProfanity, normalizeModerationText } from '../src/lib/profanity.js'
import { canPublishPublicly, canUseQuickChat } from '../src/lib/permissions.js'
import { buildApprovedVideoKey, buildPendingVideoKey, buildRejectedVideoKey, cloudfrontUrlForKey } from '../src/lib/storage.js'
import { mapDiditResult } from '../src/lib/didit.js'
import { readFileSync } from 'node:fs'
import { authenticateSupabaseToken, findOrCreateUserFromSupabase, mapSupabaseUserToPrismaData } from '../src/middleware/auth.js'

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


test('Supabase user mapping creates the Prisma user fields protected routes expect', () => {
  const mapped = mapSupabaseUserToPrismaData({
    id: '2f46ad14-9f10-45e8-b7aa-1abafabcb101',
    email: 'Creator.One@example.com',
    user_metadata: { username: 'Creator One!', full_name: 'Creator One' },
  })

  assert.deepEqual(mapped, {
    id: '2f46ad14-9f10-45e8-b7aa-1abafabcb101',
    email: 'Creator.One@example.com',
    username: 'creator_one',
    fullName: 'Creator One',
    passwordHash: 'supabase-auth-managed',
    verificationStatus: 'unverified',
    generatedAvatarSeed: 'creator_one',
    generatedAvatarVariant: 'animal',
  })
})

test('Supabase auth mapping finds existing users before creating local Prisma rows', async () => {
  const existingUser = { id: 'supabase-user-id', email: 'user@example.test', username: 'creator' }
  const calls = []
  const fakePrisma = {
    user: {
      findUnique: async (args) => {
        calls.push(['findUnique', args.where.id])
        return existingUser
      },
      create: async () => {
        throw new Error('create should not be called for existing users')
      },
    },
  }

  const result = await findOrCreateUserFromSupabase({ id: 'supabase-user-id', email: 'user@example.test', user_metadata: {} }, fakePrisma)

  assert.equal(result, existingUser)
  assert.deepEqual(calls, [['findUnique', 'supabase-user-id']])
})

test('Supabase auth mapping creates a Prisma user when none exists', async () => {
  let createdArgs
  const fakePrisma = {
    user: {
      findUnique: async () => null,
      create: async (args) => {
        createdArgs = args
        return { ...args.data, privacy: 'public', role: 'user', verificationProvider: null, verifiedAt: null }
      },
    },
  }

  const result = await findOrCreateUserFromSupabase({
    id: '2f46ad14-9f10-45e8-b7aa-1abafabcb101',
    email: 'new.user@example.test',
    user_metadata: { fullName: 'New User' },
  }, fakePrisma)

  assert.equal(createdArgs.data.id, '2f46ad14-9f10-45e8-b7aa-1abafabcb101')
  assert.equal(createdArgs.data.email, 'new.user@example.test')
  assert.equal(createdArgs.data.username, 'new_user')
  assert.equal(createdArgs.data.fullName, 'New User')
  assert.equal(createdArgs.data.passwordHash, 'supabase-auth-managed')
  assert.equal(createdArgs.data.verificationStatus, 'unverified')
  assert.equal(result.generatedAvatarVariant, 'animal')
})

test('protected frontend UVideo API helpers use Supabase sessions instead of local Express JWT storage', () => {
  const source = readFileSync(new URL('../../src/lib/contentApi.js', import.meta.url), 'utf8')

  assert.match(source, /supabase\.auth\.getSession\(\)/)
  assert.match(source, /export async function getSupabaseAccessToken/)
  assert.match(source, /requestVideoUpload[\s\S]*await getSupabaseAccessToken\(\)/)
  assert.match(source, /completeVideoUpload[\s\S]*await getSupabaseAccessToken\(\)/)
  assert.match(source, /suggestQuickChatPhrase[\s\S]*await getSupabaseAccessToken\(\)/)
  assert.doesNotMatch(source, /uvideo_api_token/)
  assert.doesNotMatch(source, /localStorage\.getItem/)
})

test('apiRequest sends bearer authorization when provided a Supabase access token', () => {
  const source = readFileSync(new URL('../../src/lib/apiClient.js', import.meta.url), 'utf8')

  assert.match(source, /Authorization: `Bearer \$\{token\}`/)
})


test('Supabase token authentication verifies bearer tokens with Supabase auth', async () => {
  const fakeSupabase = {
    auth: {
      getUser: async (token) => {
        assert.equal(token, 'supabase-access-token')
        return { data: { user: { id: 'supabase-user-id', email: 'creator@example.test', user_metadata: { username: 'creator' } } }, error: null }
      },
    },
  }
  const fakePrisma = {
    user: {
      findUnique: async () => ({ id: 'supabase-user-id', email: 'creator@example.test', username: 'creator' }),
      create: async () => { throw new Error('not needed') },
    },
  }

  const user = await authenticateSupabaseToken('supabase-access-token', fakeSupabase, fakePrisma)

  assert.equal(user.id, 'supabase-user-id')
  assert.equal(user.email, 'creator@example.test')
})

test('Supabase token authentication rejects invalid or expired tokens', async () => {
  const fakeSupabase = { auth: { getUser: async () => ({ data: { user: null }, error: new Error('expired') }) } }

  const user = await authenticateSupabaseToken('expired-token', fakeSupabase, { user: {} })

  assert.equal(user, null)
})
