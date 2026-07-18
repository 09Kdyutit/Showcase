import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { requirePersistedRow } from '../src/lib/db-authority.ts'
import { resumeIntakePath, safeResumeReturnTo } from '../src/lib/constants.ts'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const [constants, onboarding, dashboard, resumePage, builderIndex, builderEditor, audit, projects, tailor, jobs, opportunities, analyzeRoute] = await Promise.all([
  read('src/lib/constants.ts'),
  read('src/app/(app)/onboarding/page.tsx'),
  read('src/app/(app)/dashboard/page.tsx'),
  read('src/app/(app)/resume/page.tsx'),
  read('src/app/(app)/builder/page.tsx'),
  read('src/app/(app)/builder/[portfolioId]/page.tsx'),
  read('src/app/(app)/audit/page.tsx'),
  read('src/app/(app)/projects/page.tsx'),
  read('src/app/(app)/jobs/[savedJobId]/tailor/page.tsx'),
  read('src/app/(app)/jobs/page.tsx'),
  read('src/components/opportunities/opportunities-view.tsx'),
  read('src/app/api/ai/analyze-resume/route.ts'),
])

assert.match(constants, /RESUME_INTAKE_PATH = '\/onboarding\?intent=resume'/)
assert.match(onboarding, /params\.get\('intent'\) === 'resume'/)
assert.equal(resumeIntakePath('/builder/example'), '/onboarding?intent=resume&returnTo=%2Fbuilder%2Fexample')
assert.equal(safeResumeReturnTo('/jobs/example/tailor'), '/jobs/example/tailor')
assert.equal(safeResumeReturnTo('https://example.com'), '/dashboard')
assert.equal(safeResumeReturnTo('//example.com'), '/dashboard')
assert.equal(safeResumeReturnTo('/billing'), '/dashboard')

for (const [name, source] of Object.entries({
  dashboard,
  resumePage,
  builderIndex,
  builderEditor,
  audit,
  projects,
  tailor,
  jobs,
  opportunities,
})) {
  assert.match(source, /resumeIntakePath/, `${name} must preserve the caller through the canonical resume intake route`)
}

assert.match(builderIndex, /const hasResume = !!resumeRes\.data/)
assert.match(builderIndex, /if \(resumeRes\.error\) throw new Error/)
assert.match(builderIndex, /\.not\('parsed_json', 'is', null\)/)
assert.match(builderIndex, /hasResume \? \(/)
assert.match(builderEditor, /const \[resumeLoadError, setResumeLoadError\]/)
assert.match(builderEditor, /setResumeLoadError\(!!resumeRes\.error\)/)
assert.match(builderEditor, /resumeLoadError \? \(/)
assert.equal(requirePersistedRow({ data: { id: 'saved' }, error: null }, 'failed').id, 'saved')
assert.throws(
  () => requirePersistedRow({ data: null, error: null }, 'zero rows'),
  /zero rows/
)
assert.throws(
  () => requirePersistedRow({ data: { id: 'ignored' }, error: { message: 'write failed' } }, 'write failed'),
  /write failed/
)
assert.match(onboarding, /\.select\('id'\)\s*\.single\(\)/)
assert.match(analyzeRoute, /requirePersistedRow\(resumeWrite, 'Could not save the analyzed resume'\)/)
assert.doesNotMatch(onboarding, /\.from\('resumes'\)\s*\.insert/)
assert.equal(
  [...onboarding.matchAll(/if \(params\.get\('intent'\) === 'resume'\) return/g)].length,
  0,
  'routine resume import must not bypass the canonical admission refresh gate'
)
assert.match(onboarding, /selectPendingAdmission\([\s\S]*?redeemPendingAdmission/)
assert.match(onboarding, /disabled=\{admissionPending\}/)
assert.match(onboarding, /resumeReturnTo \? finishResumeImport : createPortfolio/)

const rejectIndex = analyzeRoute.indexOf("code: 'EMPTY_PARSE'")
const insertIndex = analyzeRoute.indexOf(".from('resumes')", rejectIndex)
assert.ok(rejectIndex >= 0 && insertIndex > rejectIndex, 'resume persistence must happen only after a readable parse')
assert.match(analyzeRoute, /\.insert\(\{[\s\S]*parsed_json: result/)
assert.match(analyzeRoute, /return NextResponse\.json\(\{ data: result, resumeId: persistedResumeId \}\)/)

console.log('resume intake path tests passed')
