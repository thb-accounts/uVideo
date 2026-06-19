export function mapDiditResult(payload = {}) {
  const result = payload.result || payload.verificationStatus || payload.age_result
  if (result === 'verified_18_plus' || result === '18_plus' || result === 'over_18') return 'verified_18_plus'
  if (result === 'verified_15_plus' || result === '15_plus' || result === 'over_15') return 'verified_15_plus'
  if (payload.minimumAge >= 18 || payload.ageRange === '18+') return 'verified_18_plus'
  if (payload.minimumAge >= 15 || payload.ageRange === '15+') return 'verified_15_plus'
  if (payload.passed === true && payload.threshold === 18) return 'verified_18_plus'
  if (payload.passed === true && payload.threshold === 15) return 'verified_15_plus'
  return null
}
