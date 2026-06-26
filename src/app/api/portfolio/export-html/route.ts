import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PortfolioContent } from '@/types/database'
import { coerceThemeId } from '@/lib/portfolio/themes'

// POST /api/portfolio/export-html
// Body: { portfolioId: string }
// Returns: standalone .html file download — no build tools, no JS frameworks required.
// The exported file uses Tailwind CDN + vanilla JS for a portable, hostable snapshot.

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { portfolioId: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { portfolioId } = body
  if (!portfolioId) return NextResponse.json({ error: 'portfolioId required' }, { status: 400 })

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('*')
    .eq('id', portfolioId)
    .eq('user_id', user.id)
    .single()

  if (!portfolio) return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 })

  const content = (portfolio.content as unknown as Partial<PortfolioContent>) ?? {}
  const theme = coerceThemeId(portfolio.theme)
  const html = generatePortfolioHtml(portfolio.title, portfolio.target_role, content, theme)

  const filename = portfolio.slug
    ? `${portfolio.slug}-portfolio.html`
    : `${portfolio.title.toLowerCase().replace(/\s+/g, '-')}-portfolio.html`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

// ─── HTML generator ────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function safeUrl(url: string | null | undefined): string {
  if (!url) return '#'
  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed)) return esc(trimmed)
  if (trimmed.startsWith('//')) return esc('https:' + trimmed)
  if (trimmed.startsWith('linkedin.com') || trimmed.startsWith('github.com')) return esc('https://' + trimmed)
  return '#'
}

function generatePortfolioHtml(
  title: string,
  targetRole: string | null,
  content: Partial<PortfolioContent>,
  theme: string
): string {
  const hero = content.hero
  const about = content.about
  const skills = content.skills ?? []
  const experience = content.experience ?? []
  const projects = content.projects ?? []
  const proof = content.proof?.filter(p => p.value && p.label) ?? []
  const contact = content.contact
  const cta = content.cta

  // Determine accent color from theme
  const themeAccents: Record<string, string> = {
    'cinematic-dark': '#e91e8c',
    'executive-dark': '#818cf8',
    'neon-night': '#00f5ff',
    'glassmorphism': '#818cf8',
    'gradient-studio': '#f72585',
    'bento': '#a3e635',
    'creative-case-study': '#f97316',
    'minimal-3d': '#0066ff',
    'clean-editorial': '#18181b',
    'magazine': '#e85d2a',
  }
  const accent = (content as { accentColor?: string }).accentColor ?? themeAccents[theme] ?? '#e91e8c'
  const isDark = ['cinematic-dark','executive-dark','neon-night','glassmorphism','bento','creative-case-study'].includes(theme)

  const bg = isDark ? '#050508' : '#fafafa'
  const textPrimary = isDark ? '#ffffff' : '#0a0a0a'
  const textMuted = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

  const skillsByCategory = skills.reduce<Record<string, typeof skills>>((acc, s) => {
    const cat = s.category || 'Skills'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {})

  const bioParagraphs = about?.bio?.split('\n\n').filter(Boolean) ?? []

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)} · Portfolio</title>
  <meta name="description" content="${esc(hero?.subheadline ?? `${title}'s professional portfolio`)}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: ${bg};
      color: ${textPrimary};
      line-height: 1.6;
      overflow-x: hidden;
    }
    .font-display { font-family: 'Anton', Impact, sans-serif; }
    .accent { color: ${accent}; }
    a { color: inherit; text-decoration: none; }
    img { max-width: 100%; height: auto; }

    /* Nav */
    nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      height: 64px; display: flex; align-items: center; justify-content: space-between;
      padding: 0 40px;
      background: ${isDark ? 'rgba(5,5,8,0.9)' : 'rgba(250,250,250,0.9)'};
      backdrop-filter: blur(20px);
      border-bottom: 1px solid ${cardBorder};
    }
    .nav-logo { font-weight: 700; font-size: 15px; }
    .nav-role { font-size: 12px; color: ${textMuted}; margin-left: 8px; }
    .nav-links { display: flex; gap: 12px; }
    .nav-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; border-radius: 100px; font-size: 12px; font-weight: 600;
      transition: all 0.2s; cursor: pointer;
    }
    .nav-btn-primary { background: ${accent}; color: white; border: none; }
    .nav-btn-ghost { background: ${accent}18; color: ${accent}; border: 1px solid ${accent}30; }
    .nav-btn:hover { filter: brightness(1.1); transform: scale(1.02); }

    /* Sections */
    section { padding: 100px 0; }
    .container { max-width: 1100px; margin: 0 auto; padding: 0 40px; }

    /* Hero */
    #hero {
      min-height: 100vh; display: flex; align-items: center; padding-top: 80px;
      position: relative;
    }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 16px; border-radius: 100px; margin-bottom: 32px;
      background: ${accent}12; border: 1px solid ${accent}30; color: ${accent};
      font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
    }
    .hero-dot { width: 6px; height: 6px; border-radius: 50%; background: ${accent}; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    .hero-headline {
      font-family: 'Anton', Impact, sans-serif;
      line-height: 1; margin-bottom: 16px;
      font-size: clamp(3rem, 10vw, 8rem);
    }
    .hero-name { color: ${accent}; }
    .hero-intro { color: ${isDark ? 'rgba(255,255,255,0.85)' : textPrimary}; }
    .hero-sub { font-size: 18px; color: ${textMuted}; max-width: 560px; margin-bottom: 8px; }
    .hero-status { display: flex; align-items: center; gap: 8px; font-size: 14px; color: ${textMuted}; margin-bottom: 32px; }
    .hero-ctas { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 64px; }
    .btn-primary {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 12px 24px; border-radius: 100px; font-size: 14px; font-weight: 600;
      background: ${accent}; color: white; transition: all 0.2s;
    }
    .btn-ghost {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 12px 24px; border-radius: 100px; font-size: 14px; font-weight: 600;
      background: transparent; color: ${isDark ? 'rgba(255,255,255,0.7)' : textPrimary};
      border: 1px solid ${cardBorder}; transition: all 0.2s;
    }
    .btn-primary:hover, .btn-ghost:hover { transform: scale(1.02); }
    .proof-row { display: flex; flex-wrap: wrap; gap: 0; border-left: 1px solid ${cardBorder}; }
    .proof-item { padding: 0 24px; border-right: 1px solid ${cardBorder}; text-align: center; }
    .proof-value { font-size: 32px; font-weight: 900; color: ${accent}; line-height: 1.2; }
    .proof-label { font-size: 10px; color: ${textMuted}; letter-spacing: 0.15em; text-transform: uppercase; margin-top: 4px; }

    /* Marquee */
    .marquee-wrap {
      overflow: hidden; padding: 12px 0;
      border-top: 1px solid ${cardBorder}; border-bottom: 1px solid ${cardBorder};
    }
    .marquee-track {
      display: flex; gap: 32px; white-space: nowrap;
      animation: marquee 30s linear infinite;
    }
    @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
    .marquee-item { font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: ${textMuted}; }
    .marquee-dot { color: ${accent}; }

    /* Section headers */
    .section-label {
      display: flex; align-items: center; gap: 12px;
      font-size: 10px; letter-spacing: 0.4em; text-transform: uppercase;
      color: ${textMuted}; margin-bottom: 16px;
    }
    .section-label::before { content: ''; display: block; width: 32px; height: 1px; background: ${cardBorder}; }
    .section-headline {
      font-family: 'Anton', Impact, sans-serif;
      line-height: 1; color: ${textPrimary};
      font-size: clamp(2.5rem, 7vw, 6rem);
      margin-bottom: 48px;
    }

    /* Cards */
    .card {
      background: ${cardBg}; border: 1px solid ${cardBorder};
      border-radius: 16px; padding: 24px;
      transition: transform 0.2s, border-color 0.2s;
    }
    .card:hover { transform: translateY(-4px); border-color: ${accent}40; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .grid-auto { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }

    /* Experience */
    .exp-type {
      font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase;
      color: ${accent}; margin-bottom: 12px;
      display: flex; align-items: center; gap: 8px;
    }
    .exp-role { font-weight: 700; font-size: 16px; color: ${textPrimary}; margin-bottom: 4px; }
    .exp-company { font-size: 14px; color: ${textMuted}; margin-bottom: 4px; }
    .exp-period { font-size: 12px; color: ${accent}70; margin-bottom: 12px; }
    .bullet { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: ${textMuted}; line-height: 1.5; margin-bottom: 4px; }
    .bullet-dot { width: 4px; height: 4px; border-radius: 50%; background: ${cardBorder}; flex-shrink: 0; margin-top: 6px; }

    /* Projects */
    .project-img { width: 100%; height: 200px; object-fit: cover; border-radius: 12px 12px 0 0; }
    .project-num {
      height: 140px; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, ${accent}12, ${accent}05);
      border-radius: 12px 12px 0 0;
      font-family: 'Anton', Impact, sans-serif; font-size: 56px; color: ${accent}40;
    }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .tag {
      padding: 3px 10px; border-radius: 100px; font-size: 10px; font-weight: 600;
      background: ${accent}15; color: ${accent}; border: 1px solid ${accent}25; letter-spacing: 0.05em;
    }
    .project-title { font-weight: 700; font-size: 18px; color: ${textPrimary}; margin-bottom: 8px; }
    .project-summary { font-size: 13px; color: ${textMuted}; margin-bottom: 12px; line-height: 1.6; }
    .project-outcome {
      font-size: 12px; padding: 8px 12px; border-radius: 8px; margin-bottom: 12px;
      background: ${accent}10; color: ${accent}cc; border: 1px solid ${accent}20;
    }
    .project-link { font-size: 11px; color: ${accent}80; letter-spacing: 0.1em; text-transform: uppercase; }
    .project-link:hover { color: ${accent}; }

    /* Skills */
    .skill-cat { font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: ${accent}; margin-bottom: 12px; }
    .skill-pills { display: flex; flex-wrap: wrap; gap: 8px; }
    .skill-pill {
      padding: 6px 14px; border-radius: 100px; font-size: 12px; font-weight: 500;
      background: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'};
      border: 1px solid ${cardBorder}; color: ${isDark ? 'rgba(255,255,255,0.7)' : textPrimary};
      transition: all 0.2s;
    }
    .skill-pill:hover { border-color: ${accent}60; transform: scale(1.03); }

    /* Contact */
    .contact-card {
      background: ${cardBg}; border: 1px solid ${cardBorder};
      border-radius: 24px; padding: 64px; position: relative; overflow: hidden;
    }
    .contact-headline {
      font-family: 'Anton', Impact, sans-serif;
      font-size: clamp(2rem, 6vw, 5rem); line-height: 1; color: ${textPrimary}; margin-bottom: 20px;
    }
    .contact-sub { font-size: 14px; color: ${textMuted}; max-width: 400px; margin-bottom: 32px; }
    .contact-ctas { display: flex; flex-wrap: wrap; gap: 12px; }

    /* Footer */
    footer { padding: 24px 40px; display: flex; justify-content: space-between; align-items: center; }
    .footer-text { font-size: 12px; color: ${textMuted}; }

    /* Responsive */
    @media (max-width: 768px) {
      nav, footer { padding: 0 20px; }
      .container { padding: 0 20px; }
      .grid-2 { grid-template-columns: 1fr; }
      section { padding: 64px 0; }
      .contact-card { padding: 32px; }
    }
  </style>
</head>
<body>

  <!-- NAV -->
  <nav>
    <div style="display:flex;align-items:center;gap:8px;">
      ${hero?.headshotUrl
        ? `<img src="${esc(hero.headshotUrl)}" alt="${esc(title)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" />`
        : `<div style="width:32px;height:32px;border-radius:50%;background:${accent}20;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${accent};">${esc(title.split(' ').map(w => w[0]).join('').slice(0,2))}</div>`
      }
      <span class="nav-logo">${esc(title)}</span>
      <span class="nav-role">${targetRole ? '· ' + esc(targetRole) : ''}</span>
    </div>
    <div class="nav-links">
      ${contact?.linkedin ? `<a href="${safeUrl(contact.linkedin)}" target="_blank" class="nav-btn nav-btn-ghost">LinkedIn</a>` : ''}
      ${contact?.email ? `<a href="mailto:${esc(contact.email)}" class="nav-btn nav-btn-primary">Contact</a>` : ''}
    </div>
  </nav>

  <!-- HERO -->
  <section id="hero">
    <div class="container">
      ${hero?.tagline ? `<div class="hero-badge"><span class="hero-dot"></span>${esc(hero.tagline)}</div>` : ''}
      <div class="hero-headline">
        <div class="hero-intro">HI, I'M</div>
        <div class="hero-name">${esc(title.toUpperCase())}</div>
      </div>
      ${hero?.subheadline ? `<p class="hero-sub">${esc(hero.subheadline)}</p>` : ''}
      ${cta?.headline ? `<div class="hero-status"><span class="hero-dot"></span>${esc(cta.headline)}</div>` : ''}
      <div class="hero-ctas">
        <a href="#about" class="btn-primary">Take the Tour →</a>
        ${contact?.linkedin ? `<a href="${safeUrl(contact.linkedin)}" target="_blank" class="btn-ghost">LinkedIn</a>` : ''}
        ${contact?.email ? `<a href="mailto:${esc(contact.email)}" class="btn-ghost">Get in touch</a>` : ''}
      </div>
      ${proof.length > 0 ? `
      <div class="proof-row">
        ${proof.slice(0, 4).map(p => `
        <div class="proof-item">
          <div class="proof-value">${esc(p.value)}</div>
          <div class="proof-label">${esc(p.label)}</div>
        </div>`).join('')}
      </div>` : ''}
    </div>
  </section>

  <!-- MARQUEE -->
  ${skills.length > 0 ? `
  <div class="marquee-wrap">
    <div class="marquee-track">
      ${[...skills, ...skills].map(s => `<span class="marquee-item">${esc(s.name)}</span><span class="marquee-dot">•</span>`).join('')}
    </div>
  </div>` : ''}

  <!-- ABOUT -->
  ${about?.bio ? `
  <section id="about">
    <div class="container">
      <div class="section-label">ABOUT</div>
      <div class="section-headline">${esc((hero?.headline || 'BUILDER,\nLEADER,\nENGINEER').split(/[,\n]/).slice(0,3).map(w => w.trim().toUpperCase()).join(',<br>'))}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;">
        <div>
          ${bioParagraphs.map(p => `<p style="color:${textMuted};font-size:15px;line-height:1.8;margin-bottom:20px;">${esc(p)}</p>`).join('')}
        </div>
        ${about.values?.length ? `
        <div class="card">
          <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:${textMuted};margin-bottom:16px;">Core Values</div>
          ${about.values.map(v => `
          <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;">
            <span style="width:6px;height:6px;border-radius:50%;background:${accent};flex-shrink:0;margin-top:7px;"></span>
            <span style="font-size:14px;color:${textMuted};">${esc(v)}</span>
          </div>`).join('')}
        </div>` : ''}
      </div>
    </div>
  </section>` : ''}

  <!-- EXPERIENCE -->
  ${experience.length > 0 ? `
  <section id="experience">
    <div class="container">
      <div class="section-label">EXPERIENCE</div>
      <div class="section-headline">ROLES IN<br>MOTION</div>
      <div class="grid-2">
        ${experience.slice(0, 6).map(exp => `
        <div class="card">
          <div class="exp-type">✦ ${esc(
            exp.role?.includes('VP') || exp.role?.includes('President') || exp.role?.includes('Lead') ? 'LEADERSHIP' :
            exp.role?.includes('Intern') ? 'INTERNSHIP' :
            exp.role?.includes('Research') ? 'RESEARCH' : 'ROLE'
          )}</div>
          <div class="exp-role">${esc(exp.role)}</div>
          <div class="exp-company">${esc(exp.company)}</div>
          ${exp.period ? `<div class="exp-period">${esc(exp.period)}</div>` : ''}
          ${exp.bullets.slice(0, 2).map(b => `
          <div class="bullet"><span class="bullet-dot"></span>${esc(b)}</div>`).join('')}
        </div>`).join('')}
      </div>
    </div>
  </section>` : ''}

  <!-- PROJECTS -->
  ${projects.length > 0 ? `
  <section id="projects">
    <div class="container">
      <div class="section-label">FEATURED PROJECTS</div>
      <div class="section-headline">CASE<br>STUDIES</div>
      <div class="grid-2">
        ${projects.map((proj, i) => `
        <div class="card" style="padding:0;overflow:hidden;">
          ${proj.imageUrl
            ? `<img src="${esc(proj.imageUrl)}" alt="${esc(proj.title)}" class="project-img" />`
            : `<div class="project-num">${String(i + 1).padStart(2, '0')}</div>`
          }
          <div style="padding:24px;">
            ${proj.tags?.length ? `<div class="tags">${proj.tags.slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
            <div class="project-title">${esc(proj.title)}</div>
            ${proj.summary ? `<div class="project-summary">${esc(proj.summary)}</div>` : ''}
            ${proj.outcome ? `<div class="project-outcome">${esc(proj.outcome)}</div>` : ''}
            ${proj.links?.length ? `<a href="${safeUrl(proj.links[0].url)}" target="_blank" class="project-link">VIEW CASE STUDY →</a>` : ''}
          </div>
        </div>`).join('')}
      </div>
    </div>
  </section>` : ''}

  <!-- SKILLS -->
  ${Object.keys(skillsByCategory).length > 0 ? `
  <section id="skills">
    <div class="container">
      <div class="section-label">TOOLKIT</div>
      <div class="section-headline">CAPABILITY<br>STACK</div>
      <div class="grid-2">
        ${Object.entries(skillsByCategory).map(([cat, catSkills]) => `
        <div class="card">
          <div class="skill-cat">${esc(cat)}</div>
          <div class="skill-pills">
            ${catSkills.map(s => `<span class="skill-pill">${esc(s.name)}</span>`).join('')}
          </div>
        </div>`).join('')}
      </div>
    </div>
  </section>` : ''}

  <!-- CONTACT -->
  <section id="contact">
    <div class="container">
      <div class="contact-card">
        <div class="section-label">CONTACT</div>
        <div class="contact-headline">LET'S BUILD<br>SOMETHING<br>EXCEPTIONAL</div>
        ${about?.bio ? `<p class="contact-sub">${esc(about.bio.split('.')[0])}.</p>` : ''}
        <div class="contact-ctas">
          ${contact?.email ? `<a href="mailto:${esc(contact.email)}" class="btn-primary">✉ Email ${esc(title.split(' ')[0])}</a>` : ''}
          ${contact?.linkedin ? `<a href="${safeUrl(contact.linkedin)}" target="_blank" class="btn-ghost">LinkedIn</a>` : ''}
          ${contact?.website ? `<a href="${safeUrl(contact.website)}" target="_blank" class="btn-ghost">Website</a>` : ''}
        </div>
      </div>
    </div>
  </section>

  <footer>
    <span class="footer-text">${esc(title)}</span>
    <span class="footer-text">Built with Showcase</span>
  </footer>

</body>
</html>`
}
