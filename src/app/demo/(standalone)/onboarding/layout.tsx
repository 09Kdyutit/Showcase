// Override parent demo layout  -  onboarding is a standalone auth flow with no sidebar
export default function DemoOnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
