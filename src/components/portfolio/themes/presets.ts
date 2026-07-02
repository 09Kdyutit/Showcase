import type { ThemePreset } from './preset-theme'

// 30 advanced, professional, futuristic portfolio presets. Each drives the single premium
// engine in ./preset-theme.tsx, so all 30 are production-quality and genuinely distinct
// (palette + background treatment + card style + typography all vary). Order here is the
// order they appear in the builder's theme picker.

const SANS = 'var(--font-geist-sans), system-ui, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, monospace'
const SERIF = 'var(--font-fraunces), Georgia, serif'
const ROUND = 'var(--font-rounded), var(--font-geist-sans), sans-serif'

const F = {
  tech: { display: SANS, body: SANS, mono: MONO },
  editorial: { display: SERIF, body: SANS, mono: MONO },
  rounded: { display: ROUND, body: SANS, mono: MONO },
  terminal: { display: MONO, body: SANS, mono: MONO },
}

export const PRESETS: ThemePreset[] = [
  {
    id: 'quantum-noir', name: 'Quantum Noir', badge: '✦ New',
    description: 'Pure-black canvas with an electric-cyan grid and razor typography. Engineered, precise, unmistakably modern.',
    recommendedRoles: ['Engineering', 'AI / ML', 'Systems', 'Startup'],
    mode: 'dark', background: 'grid', card: 'glow', accentStyle: 'gradient', radius: 14,
    palette: { bg: '#050507', bg2: '#0c0d12', text: '#f4f6fb', muted: '#8a8fa3', accent: '#22d3ee', accent2: '#6366f1', border: 'rgba(255,255,255,0.08)' },
    fonts: F.tech,
  },
  {
    id: 'aurora-veil', name: 'Aurora Veil',
    description: 'Deep navy washed with drifting violet-and-teal aurora light. Atmospheric and premium.',
    recommendedRoles: ['Product', 'Design', 'Research', 'Leadership'],
    mode: 'dark', background: 'aurora', card: 'glass', accentStyle: 'gradient', radius: 18,
    palette: { bg: '#070a14', bg2: '#101524', text: '#eef1fb', muted: '#8b93ad', accent: '#a78bfa', accent2: '#2dd4bf', border: 'rgba(255,255,255,0.09)' },
    fonts: F.tech,
  },
  {
    id: 'nebula', name: 'Nebula',
    description: 'Cosmic black with magenta and indigo nebula clouds. Bold, expressive, futuristic.',
    recommendedRoles: ['Creative', 'Design', 'Marketing', 'Branding'],
    mode: 'dark', background: 'orbs', card: 'glow', accentStyle: 'gradient', radius: 20,
    palette: { bg: '#08060f', bg2: '#141021', text: '#f5effb', muted: '#9a8fb0', accent: '#e879f9', accent2: '#818cf8', border: 'rgba(255,255,255,0.08)' },
    fonts: F.tech,
  },
  {
    id: 'obsidian-gold', name: 'Obsidian Gold',
    description: 'Restrained black with warm gold hairlines. Executive, expensive, quietly powerful.',
    recommendedRoles: ['Finance', 'Consulting', 'Executive', 'Law'],
    mode: 'dark', background: 'solid', card: 'bordered', accentStyle: 'solid', radius: 8,
    palette: { bg: '#0a0a0b', bg2: '#141414', text: '#f3f1ea', muted: '#9b968a', accent: '#d4af37', accent2: '#b8860b', border: 'rgba(212,175,55,0.16)' },
    fonts: F.editorial,
  },
  {
    id: 'cyber-mint', name: 'Cyber Mint',
    description: 'Near-black terminal aesthetic with mint-green scanlines and monospace labels.',
    recommendedRoles: ['Engineering', 'Security', 'DevOps', 'Data'],
    mode: 'dark', background: 'scanlines', card: 'bordered', accentStyle: 'solid', radius: 6,
    palette: { bg: '#04070a', bg2: '#0a1014', text: '#e7fff4', muted: '#7da596', accent: '#34d399', accent2: '#10b981', border: 'rgba(52,211,153,0.16)' },
    fonts: F.terminal,
  },
  {
    id: 'ultraviolet', name: 'Ultraviolet',
    description: 'Jet-black with a single saturated violet glow. Sleek, confident, contemporary.',
    recommendedRoles: ['Product', 'Engineering', 'Startup', 'Tech Leadership'],
    mode: 'dark', background: 'mesh', card: 'glow', accentStyle: 'gradient', radius: 16,
    palette: { bg: '#060509', bg2: '#100e18', text: '#f1eefb', muted: '#8e88a3', accent: '#8b5cf6', accent2: '#c026d3', border: 'rgba(255,255,255,0.08)' },
    fonts: F.tech,
  },
  {
    id: 'solaris', name: 'Solaris',
    description: 'Charcoal with molten amber accents. Warm, energetic, and grounded.',
    recommendedRoles: ['Product', 'Operations', 'Growth', 'Founder'],
    mode: 'dark', background: 'beams', card: 'elevated', accentStyle: 'gradient', radius: 14,
    palette: { bg: '#0c0a08', bg2: '#16120d', text: '#faf3ea', muted: '#a3978a', accent: '#fb923c', accent2: '#f59e0b', border: 'rgba(255,255,255,0.08)' },
    fonts: F.tech,
  },
  {
    id: 'holographic', name: 'Holographic',
    description: 'Iridescent cyan-to-magenta gradients over black. Vivid, eye-catching, next-gen.',
    recommendedRoles: ['Design', 'Creative', 'Web3', 'Brand'],
    mode: 'dark', background: 'aurora', card: 'glass', accentStyle: 'gradient', radius: 22,
    palette: { bg: '#06070c', bg2: '#0f1119', text: '#f0f3fb', muted: '#8a92ad', accent: '#22d3ee', accent2: '#f472b6', border: 'rgba(255,255,255,0.1)' },
    fonts: F.rounded,
  },
  {
    id: 'carbon', name: 'Carbon',
    description: 'Graphite surfaces with a single crimson signal. Industrial, sharp, serious.',
    recommendedRoles: ['Engineering', 'Hardware', 'Robotics', 'Automotive'],
    mode: 'dark', background: 'grid', card: 'bordered', accentStyle: 'solid', radius: 8,
    palette: { bg: '#0b0c0e', bg2: '#15171a', text: '#eef0f2', muted: '#8c9098', accent: '#ef4444', accent2: '#dc2626', border: 'rgba(255,255,255,0.09)' },
    fonts: F.tech,
  },
  {
    id: 'vapor', name: 'Vapor',
    description: 'Dusk-purple with teal-and-pink vaporwave gradients. Retro-futuristic and playful.',
    recommendedRoles: ['Creative', 'Music', 'Design', 'Content'],
    mode: 'dark', background: 'mesh', card: 'glow', accentStyle: 'gradient', radius: 20,
    palette: { bg: '#0b0717', bg2: '#161029', text: '#f4eefb', muted: '#9b8fb5', accent: '#2dd4bf', accent2: '#f472b6', border: 'rgba(255,255,255,0.09)' },
    fonts: F.rounded,
  },
  {
    id: 'titanium', name: 'Titanium',
    description: 'Brushed metallic greys with a cool sky-blue edge. Refined, technical, durable.',
    recommendedRoles: ['Engineering', 'Product', 'Aerospace', 'Industrial'],
    mode: 'dark', background: 'dots', card: 'elevated', accentStyle: 'solid', radius: 12,
    palette: { bg: '#0d0f12', bg2: '#181b20', text: '#eef1f5', muted: '#919aa6', accent: '#38bdf8', accent2: '#0ea5e9', border: 'rgba(255,255,255,0.1)' },
    fonts: F.tech,
  },
  {
    id: 'magma', name: 'Magma',
    description: 'Volcanic black with orange-red beams of heat. High-energy and dramatic.',
    recommendedRoles: ['Founder', 'Sales', 'Growth', 'Sports'],
    mode: 'dark', background: 'beams', card: 'glow', accentStyle: 'gradient', radius: 16,
    palette: { bg: '#0a0605', bg2: '#170e0a', text: '#fcefe8', muted: '#a8938a', accent: '#f97316', accent2: '#ef4444', border: 'rgba(255,255,255,0.08)' },
    fonts: F.tech,
  },
  {
    id: 'synthwave', name: 'Synthwave',
    description: 'Deep purple horizon with a neon pink-and-cyan grid. Retro 80s, fully futuristic.',
    recommendedRoles: ['Creative', 'Game Dev', 'Design', 'Music'],
    mode: 'dark', background: 'grid', card: 'glow', accentStyle: 'gradient', radius: 14,
    palette: { bg: '#0a0618', bg2: '#160f2b', text: '#f6eefb', muted: '#a08fc0', accent: '#f472b6', accent2: '#22d3ee', border: 'rgba(244,114,182,0.18)' },
    fonts: F.tech,
  },
  {
    id: 'onyx-pro', name: 'Onyx Pro',
    description: 'Pure dark with a discreet indigo accent and floating elevated cards. Timeless.',
    recommendedRoles: ['Engineering', 'Product', 'Consulting', 'General'],
    mode: 'dark', background: 'solid', card: 'elevated', accentStyle: 'solid', radius: 14,
    palette: { bg: '#0a0a0d', bg2: '#131318', text: '#f2f3f7', muted: '#8e909c', accent: '#818cf8', accent2: '#6366f1', border: 'rgba(255,255,255,0.08)' },
    fonts: F.tech,
  },
  {
    id: 'bioluminescence', name: 'Bioluminescence',
    description: 'Abyssal teal-black lit by glowing cyan-green orbs. Organic, deep, and alive.',
    recommendedRoles: ['Science', 'Research', 'Biotech', 'Data'],
    mode: 'dark', background: 'orbs', card: 'glow', accentStyle: 'gradient', radius: 18,
    palette: { bg: '#03090a', bg2: '#0a1517', text: '#e8fbf6', muted: '#7ca39c', accent: '#2dd4bf', accent2: '#a3e635', border: 'rgba(45,212,191,0.16)' },
    fonts: F.tech,
  },
  {
    id: 'eclipse', name: 'Eclipse',
    description: 'Maximum-contrast black, white, and one red line. Brutalist and bold.',
    recommendedRoles: ['Design', 'Art Direction', 'Architecture', 'Brand'],
    mode: 'dark', background: 'solid', card: 'bordered', accentStyle: 'solid', radius: 4,
    palette: { bg: '#000000', bg2: '#0d0d0d', text: '#ffffff', muted: '#8a8a8a', accent: '#ff3b30', accent2: '#ff3b30', border: 'rgba(255,255,255,0.14)' },
    fonts: F.terminal,
  },
  {
    id: 'cosmos', name: 'Cosmos',
    description: 'Deep-space blue with a faint starfield and indigo nebulae. Vast and inspiring.',
    recommendedRoles: ['Research', 'Aerospace', 'AI / ML', 'Academia'],
    mode: 'dark', background: 'starfield', card: 'glass', accentStyle: 'gradient', radius: 16,
    palette: { bg: '#050811', bg2: '#0e1322', text: '#eef2fc', muted: '#8893ad', accent: '#60a5fa', accent2: '#a78bfa', border: 'rgba(255,255,255,0.09)' },
    fonts: F.tech,
  },
  {
    id: 'slate-terminal', name: 'Slate Terminal',
    description: 'Slate-dark with a green terminal accent and monospace headings. For builders.',
    recommendedRoles: ['Engineering', 'Backend', 'DevOps', 'Open Source'],
    mode: 'dark', background: 'scanlines', card: 'bordered', accentStyle: 'solid', radius: 6,
    palette: { bg: '#0b0e10', bg2: '#141a1d', text: '#e9f1ef', muted: '#86989a', accent: '#4ade80', accent2: '#22d3ee', border: 'rgba(255,255,255,0.1)' },
    fonts: F.terminal,
  },
  {
    id: 'rose-noir', name: 'Rosé Noir',
    description: 'Velvet black with rose-gold warmth. Elegant, distinctive, premium.',
    recommendedRoles: ['Fashion', 'Creative', 'Brand', 'Marketing'],
    mode: 'dark', background: 'mesh', card: 'glass', accentStyle: 'gradient', radius: 18,
    palette: { bg: '#0b0708', bg2: '#170f11', text: '#f9eef0', muted: '#a8919a', accent: '#fb7185', accent2: '#f0abfc', border: 'rgba(251,113,133,0.16)' },
    fonts: F.editorial,
  },
  {
    id: 'iris', name: 'Iris',
    description: 'Inky base with a flowing iris blue-violet mesh. Smooth, modern, confident.',
    recommendedRoles: ['Product', 'Design', 'Engineering', 'Startup'],
    mode: 'dark', background: 'mesh', card: 'glow', accentStyle: 'gradient', radius: 18,
    palette: { bg: '#070811', bg2: '#10121f', text: '#eef0fb', muted: '#888fab', accent: '#6366f1', accent2: '#3b82f6', border: 'rgba(255,255,255,0.08)' },
    fonts: F.tech,
  },
  {
    id: 'arctic-glass', name: 'Arctic Glass',
    description: 'Bright, cool, frosted-glass surfaces with a crisp blue accent. Clean and airy.',
    recommendedRoles: ['Product', 'Consulting', 'SaaS', 'General'],
    mode: 'light', background: 'aurora', card: 'glass', accentStyle: 'gradient', radius: 18,
    palette: { bg: '#f5f8fc', bg2: '#ffffff', text: '#0f172a', muted: '#5b677d', accent: '#2563eb', accent2: '#06b6d4', border: 'rgba(15,23,42,0.1)' },
    fonts: F.tech,
  },
  {
    id: 'monolith', name: 'Monolith',
    description: 'Warm paper with stark black ink and serif headlines. Editorial and authoritative.',
    recommendedRoles: ['Writing', 'Research', 'Consulting', 'Academia'],
    mode: 'light', background: 'solid', card: 'bordered', accentStyle: 'solid', radius: 6,
    palette: { bg: '#faf8f4', bg2: '#ffffff', text: '#1a1a18', muted: '#6b675e', accent: '#1a1a18', accent2: '#3f3f3a', border: 'rgba(26,26,24,0.12)' },
    fonts: F.editorial,
  },
  {
    id: 'sterling', name: 'Sterling',
    description: 'Cool light greys with steel-blue precision. Corporate, trustworthy, sharp.',
    recommendedRoles: ['Finance', 'Consulting', 'Operations', 'Executive'],
    mode: 'light', background: 'dots', card: 'elevated', accentStyle: 'solid', radius: 10,
    palette: { bg: '#f3f5f8', bg2: '#ffffff', text: '#1e293b', muted: '#64748b', accent: '#0f766e', accent2: '#0891b2', border: 'rgba(30,41,59,0.1)' },
    fonts: F.tech,
  },
  {
    id: 'prism', name: 'Prism',
    description: 'White canvas refracting a vibrant multi-stop gradient. Energetic and creative.',
    recommendedRoles: ['Design', 'Creative', 'Marketing', 'Startup'],
    mode: 'light', background: 'mesh', card: 'elevated', accentStyle: 'gradient', radius: 20,
    palette: { bg: '#fbfbfd', bg2: '#ffffff', text: '#18181b', muted: '#5e5e6b', accent: '#7c3aed', accent2: '#ec4899', border: 'rgba(24,24,27,0.09)' },
    fonts: F.rounded,
  },
  {
    id: 'glacier', name: 'Glacier',
    description: 'Icy whites with a deep cobalt accent. Minimal, calm, and confident.',
    recommendedRoles: ['Product', 'UX', 'SaaS', 'General'],
    mode: 'light', background: 'solid', card: 'bordered', accentStyle: 'solid', radius: 14,
    palette: { bg: '#f6f9fb', bg2: '#ffffff', text: '#0c1a2b', muted: '#5a6b7d', accent: '#1d4ed8', accent2: '#2563eb', border: 'rgba(12,26,43,0.1)' },
    fonts: F.tech,
  },
  {
    id: 'apex', name: 'Apex',
    description: 'Premium light with indigo authority and elevated cards. Boardroom-ready.',
    recommendedRoles: ['Executive', 'Consulting', 'Product Leadership', 'Finance'],
    mode: 'light', background: 'solid', card: 'elevated', accentStyle: 'gradient', radius: 12,
    palette: { bg: '#f7f7fb', bg2: '#ffffff', text: '#1a1a2e', muted: '#5d5d72', accent: '#4f46e5', accent2: '#7c3aed', border: 'rgba(26,26,46,0.09)' },
    fonts: F.editorial,
  },
  {
    id: 'voltage', name: 'Voltage',
    description: 'Black with high-voltage lime energy. Punchy, modern, impossible to ignore.',
    recommendedRoles: ['Growth', 'Founder', 'Sports', 'Creative'],
    mode: 'dark', background: 'grid', card: 'glow', accentStyle: 'solid', radius: 12,
    palette: { bg: '#070806', bg2: '#11130d', text: '#f2f6e9', muted: '#929a82', accent: '#a3e635', accent2: '#84cc16', border: 'rgba(163,230,53,0.16)' },
    fonts: F.tech,
  },
  {
    id: 'frost', name: 'Frost',
    description: 'Pale frosted light with cyan-glass cards. Fresh, clean, and contemporary.',
    recommendedRoles: ['Design', 'SaaS', 'Product', 'Healthcare'],
    mode: 'light', background: 'orbs', card: 'glass', accentStyle: 'gradient', radius: 18,
    palette: { bg: '#f2f9fb', bg2: '#ffffff', text: '#0f2027', muted: '#52707a', accent: '#0891b2', accent2: '#0ea5e9', border: 'rgba(15,32,39,0.09)' },
    fonts: F.rounded,
  },
  {
    id: 'helix', name: 'Helix',
    description: 'Black with twin emerald-and-cyan beams. Scientific, kinetic, advanced.',
    recommendedRoles: ['Engineering', 'Biotech', 'Data', 'Research'],
    mode: 'dark', background: 'beams', card: 'bordered', accentStyle: 'gradient', radius: 12,
    palette: { bg: '#050a09', bg2: '#0d1614', text: '#e9f7f3', muted: '#82a097', accent: '#10b981', accent2: '#22d3ee', border: 'rgba(255,255,255,0.09)' },
    fonts: F.tech,
  },
  {
    id: 'midnight-press', name: 'Midnight Press',
    description: 'Dark editorial with serif display and a warm amber accent. Sophisticated long-read.',
    recommendedRoles: ['Writing', 'Strategy', 'Research', 'Journalism'],
    mode: 'dark', background: 'solid', card: 'bordered', accentStyle: 'solid', radius: 8,
    palette: { bg: '#0b0b0d', bg2: '#15151a', text: '#f4f1ea', muted: '#9a958a', accent: '#fbbf24', accent2: '#f59e0b', border: 'rgba(255,255,255,0.09)' },
    fonts: F.editorial,
  },
]

// Distribute the three structural layouts across the presets so they differ in form, not
// just color: a left-rail "sidebar" set, a narrow "centered" editorial set, and the rest
// on the full-width "standard" layout.
const SIDEBAR_LAYOUT = new Set(['quantum-noir', 'aurora-veil', 'titanium', 'onyx-pro', 'slate-terminal', 'iris', 'sterling', 'glacier', 'helix', 'carbon'])
const CENTERED_LAYOUT = new Set(['obsidian-gold', 'monolith', 'rose-noir', 'midnight-press', 'apex', 'eclipse', 'prism'])
for (const preset of PRESETS) {
  preset.layout = SIDEBAR_LAYOUT.has(preset.id) ? 'sidebar' : CENTERED_LAYOUT.has(preset.id) ? 'centered' : 'standard'
}
