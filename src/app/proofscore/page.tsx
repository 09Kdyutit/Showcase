import { permanentRedirect } from 'next/navigation'

/**
 * The anonymous ProofScore lead magnet is retired. Keep this route as a permanent
 * redirect so old posts, directory listings, and saved links land on the canonical
 * Showcase application homepage instead of a dead page.
 */
export default function RetiredProofScorePage() {
  permanentRedirect('/')
}
