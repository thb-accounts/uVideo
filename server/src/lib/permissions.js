export function canUseQuickChat(user) {
  return ['verified_15_plus', 'verified_18_plus'].includes(user?.verificationStatus)
}

export function canPublishPublicly(user) {
  return canUseQuickChat(user)
}

export function isModerator(user) {
  return ['moderator', 'admin'].includes(user?.role)
}
