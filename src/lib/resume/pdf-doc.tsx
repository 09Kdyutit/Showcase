import React from 'react'
import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer'
import type { ParsedResume, TailoredContent } from '@/types/database'

// Single-column clean ATS-safe PDF resume layout.
// Uses only system-safe fonts (Helvetica) — no external font fetching at render time.

const ACCENT = '#1a1a2e'
const MUTED = '#555555'
const DIVIDER = '#e5e5e5'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
    color: '#1a1a1a',
    paddingTop: 44,
    paddingBottom: 44,
    paddingHorizontal: 52,
    backgroundColor: '#ffffff',
  },
  // Header
  header: { marginBottom: 18 },
  name: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: ACCENT, marginBottom: 4 },
  subline: { fontSize: 10, color: MUTED, marginBottom: 2 },
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  contactItem: { fontSize: 9, color: MUTED },

  // Section
  section: { marginTop: 16 },
  sectionTitle: {
    fontSize: 9, fontFamily: 'Helvetica-Bold', color: ACCENT,
    textTransform: 'uppercase', letterSpacing: 1.5,
    borderBottomWidth: 1, borderBottomColor: DIVIDER,
    paddingBottom: 4, marginBottom: 10,
  },

  // Summary
  summaryText: { fontSize: 10, color: '#333333', lineHeight: 1.6 },

  // Skills
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  skillChip: {
    fontSize: 9, color: '#333333',
    backgroundColor: '#f4f4f4',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 4,
  },

  // Experience
  expHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  expRole: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#111111' },
  expCompany: { fontSize: 10, color: MUTED, fontFamily: 'Helvetica-Oblique' },
  expPeriod: { fontSize: 9, color: MUTED },
  expBlock: { marginBottom: 12 },
  bullet: { flexDirection: 'row', gap: 6, marginBottom: 2, paddingLeft: 2 },
  bulletDot: { fontSize: 10, color: MUTED, marginTop: 0.5 },
  bulletText: { fontSize: 10, color: '#222222', flex: 1, lineHeight: 1.5 },

  // Projects
  projTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111111', marginBottom: 2 },
  projTech: { fontSize: 9, color: MUTED, marginBottom: 2 },
  projDesc: { fontSize: 10, color: '#333333', lineHeight: 1.5 },
  projBlock: { marginBottom: 10 },

  // Education / certs
  eduLine: { fontSize: 10, color: '#222222', marginBottom: 2 },
  eduSub: { fontSize: 9, color: MUTED },
})

export function buildResumePdfDoc(
  parsed: ParsedResume | null,
  content: TailoredContent | null
) {
  if (content) return buildFromTailored(content)
  if (parsed) return buildFromParsed(parsed)
  return buildEmpty()
}

function buildFromParsed(p: ParsedResume) {
  const contactParts = [p.email, p.phone, p.location].filter(Boolean)
  const links = [p.links?.linkedin, p.links?.github, p.links?.website].filter(Boolean)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {p.name && <Text style={styles.name}>{p.name}</Text>}
          {contactParts.length > 0 && (
            <View style={styles.contactRow}>
              {contactParts.map((c, i) => <Text key={i} style={styles.contactItem}>{c}</Text>)}
              {links.map((l, i) => <Text key={i} style={styles.contactItem}>{l}</Text>)}
            </View>
          )}
        </View>

        {/* Summary */}
        {p.summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.summaryText}>{p.summary}</Text>
          </View>
        )}

        {/* Skills */}
        {p.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skillsRow}>
              {p.skills.map((s, i) => <Text key={i} style={styles.skillChip}>{s}</Text>)}
            </View>
          </View>
        )}

        {/* Experience */}
        {p.experience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience</Text>
            {p.experience.map((exp, i) => (
              <View key={i} style={styles.expBlock}>
                <View style={styles.expHeader}>
                  <View>
                    <Text style={styles.expRole}>{exp.role}</Text>
                    <Text style={styles.expCompany}>{exp.company}</Text>
                  </View>
                  {exp.period && <Text style={styles.expPeriod}>{exp.period}</Text>}
                </View>
                {exp.bullets.map((b, j) => (
                  <View key={j} style={styles.bullet}>
                    <Text style={styles.bulletDot}>·</Text>
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Projects */}
        {p.projects.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Projects</Text>
            {p.projects.map((proj, i) => (
              <View key={i} style={styles.projBlock}>
                <Text style={styles.projTitle}>{proj.title}</Text>
                {proj.technologies.length > 0 && (
                  <Text style={styles.projTech}>{proj.technologies.join(' · ')}</Text>
                )}
                {proj.description && <Text style={styles.projDesc}>{proj.description}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {p.education.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            {p.education.map((edu, i) => (
              <View key={i} style={{ marginBottom: 6 }}>
                <Text style={styles.eduLine}>{edu.degree} — {edu.institution}{edu.year ? ` (${edu.year})` : ''}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Certifications */}
        {p.certifications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Certifications</Text>
            {p.certifications.map((cert, i) => (
              <View key={i} style={styles.bullet}>
                <Text style={styles.bulletDot}>·</Text>
                <Text style={styles.bulletText}>{cert}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  )
}

function buildFromTailored(c: TailoredContent) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Summary */}
        {c.professional_summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Professional Summary</Text>
            <Text style={styles.summaryText}>{c.professional_summary}</Text>
          </View>
        )}

        {/* Skills */}
        {c.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skillsRow}>
              {c.skills.map((s, i) => <Text key={i} style={styles.skillChip}>{s}</Text>)}
            </View>
          </View>
        )}

        {/* Experience */}
        {c.experience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience</Text>
            {c.experience.map((exp, i) => (
              <View key={i} style={styles.expBlock}>
                <View style={styles.expHeader}>
                  <View>
                    <Text style={styles.expRole}>{exp.role}</Text>
                    <Text style={styles.expCompany}>{exp.company}</Text>
                  </View>
                  {exp.period && <Text style={styles.expPeriod}>{exp.period}</Text>}
                </View>
                {exp.tailored_bullets
                  .filter(b => b.accepted !== false)
                  .map((b, j) => (
                    <View key={j} style={styles.bullet}>
                      <Text style={styles.bulletDot}>·</Text>
                      <Text style={styles.bulletText}>{b.tailored}</Text>
                    </View>
                  ))}
              </View>
            ))}
          </View>
        )}

        {/* Cover letter (if present) */}
        {c.cover_letter && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cover Letter</Text>
            <Text style={styles.summaryText}>{c.cover_letter}</Text>
          </View>
        )}
      </Page>
    </Document>
  )
}

function buildEmpty() {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={{ color: MUTED }}>No resume content available.</Text>
      </Page>
    </Document>
  )
}
