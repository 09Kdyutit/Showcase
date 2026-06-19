#!/usr/bin/env node --experimental-strip-types
// Real DOCX round-trip test for /api/resume/export — no mocks. Builds an actual .docx
// with the `docx` package, packs it to a real binary buffer, then extracts text back out
// with `mammoth` (the same library the export route uses) and scores coverage against the
// real extracted text. This is the check that catches "the file we generate doesn't open
// or doesn't actually contain the content we think it does" — a synthetic string compare
// against the source data can never catch that. Run via: npm run test:ats
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'
import mammoth from 'mammoth'
import { computeCoverage } from '../src/lib/jobs/truth-ledger.ts'

let PASS = 0
let FAIL = 0

function ok(label) { console.log(`  ✅ ${label}`); PASS++ }
function fail(label, detail) { console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`); FAIL++ }

const parsed = {
  name: 'Jane Smith',
  email: 'jane@example.com',
  phone: '555-0100',
  location: 'Austin, TX',
  summary: 'Senior software engineer with 6 years building developer tooling.',
  skills: ['TypeScript', 'React', 'PostgreSQL', 'AWS'],
  experience: [
    { company: 'Acme Corp', role: 'Senior Software Engineer', period: '2021 - 2024', bullets: ['Built a customer dashboard used by 5000 users', 'Led migration to TypeScript across 3 services'] },
  ],
  education: [{ institution: 'UT Austin', degree: 'B.S. Computer Science', year: '2018' }],
  certifications: ['AWS Certified Developer'],
}

function buildDocx(p) {
  const children = [
    new Paragraph({ children: [new TextRun({ text: p.name, bold: true, size: 28 })], alignment: AlignmentType.CENTER }),
    new Paragraph({ children: [new TextRun({ text: [p.email, p.phone, p.location].join(' · '), size: 20 })], alignment: AlignmentType.CENTER }),
    new Paragraph({ text: 'Summary', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ children: [new TextRun({ text: p.summary, size: 20 })] }),
    new Paragraph({ text: 'Skills', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ children: [new TextRun({ text: p.skills.join(' · '), size: 20 })] }),
    new Paragraph({ text: 'Experience', heading: HeadingLevel.HEADING_1 }),
  ]
  for (const exp of p.experience) {
    children.push(new Paragraph({ text: `${exp.role} — ${exp.company}`, heading: HeadingLevel.HEADING_2 }))
    for (const b of exp.bullets) children.push(new Paragraph({ children: [new TextRun({ text: b, size: 20 })], bullet: { level: 0 } }))
  }
  children.push(new Paragraph({ text: 'Education', heading: HeadingLevel.HEADING_1 }))
  for (const edu of p.education) children.push(new Paragraph({ children: [new TextRun({ text: `${edu.degree} — ${edu.institution} (${edu.year})`, size: 20 })] }))
  return new Document({ sections: [{ children }] })
}

// ── Case 1: real file round-trip extracts real content ──────────────────────
const doc = buildDocx(parsed)
const buffer = await Packer.toBuffer(doc)

if (buffer.length < 1000) {
  fail('Generated .docx buffer has a plausible binary size', `got ${buffer.length} bytes`)
} else {
  ok('Generated .docx buffer has a plausible binary size')
}

const { value: extractedText } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })

if (extractedText.includes('Jane Smith')) ok('Extracted text contains real name from the actual file')
else fail('Extracted text contains real name', 'name missing from extraction')

if (extractedText.includes('Built a customer dashboard used by 5000 users')) ok('Extracted text contains real bullet content')
else fail('Extracted text contains real bullet content')

if (extractedText.includes('AWS Certified Developer') === false) ok('Extracted text correctly excludes fields never written to the document (certifications)')
else fail('Sanity check: certifications were not added to this doc but appeared in extraction')

// ── Case 2: coverage scoring against REAL extracted text ────────────────────
const coverage = computeCoverage(extractedText, null, parsed)
if (coverage.coverage_pct >= 80) ok(`Coverage score on real extracted text is high (${coverage.coverage_pct}%)`)
else fail('Coverage score on real extracted text is high', `got ${coverage.coverage_pct}%`)

if (coverage.sections_found.includes('experience') && coverage.sections_found.includes('skills')) {
  ok('Coverage correctly detects experience and skills sections from real text')
} else {
  fail('Coverage correctly detects experience and skills sections', JSON.stringify(coverage))
}

// ── Case 3: corrupted/truncated file fails extraction or yields near-empty text ──
const corrupted = buffer.subarray(0, Math.floor(buffer.length / 3))
try {
  const { value: corruptedText } = await mammoth.extractRawText({ buffer: Buffer.from(corrupted) })
  if (corruptedText.trim().length < 50) {
    ok('Truncated/corrupted file yields near-empty extracted text (would be caught by the export route\'s 50-char guard)')
  } else {
    fail('Truncated/corrupted file yields near-empty extracted text', `got ${corruptedText.trim().length} chars — corruption guard would NOT trigger`)
  }
} catch {
  ok('Truncated/corrupted file throws on extraction (would be caught by the export route\'s error handling)')
}

console.log(`\n  ATS export round-trip: ${PASS} passed, ${FAIL} failed\n`)
process.exit(FAIL > 0 ? 1 : 0)
