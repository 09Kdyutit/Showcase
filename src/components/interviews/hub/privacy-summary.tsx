import { ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function PrivacySummary({ transcriptRetentionDays, rawAudioRetentionEnabled, liveVoiceAvailable }: {
  transcriptRetentionDays: number
  rawAudioRetentionEnabled: boolean
  liveVoiceAvailable: boolean
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Privacy</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-1.5">
        <p>Your practice sessions are private by default  -  only you can see your transcripts and scores.</p>
        <p>Transcripts are retained for {transcriptRetentionDays} days, then deleted.</p>
        <p>Raw audio recording is {rawAudioRetentionEnabled ? 'enabled for your account' : 'off  -  only a text transcript is kept'}.</p>
        <p>
          {liveVoiceAvailable
            ? 'Live voice interviews use your microphone only during the call, to send your spoken answers for real-time transcription.'
            : 'Live voice interviews are not yet available  -  Written mode never uses your microphone.'}
        </p>
        <p>You can delete any session and its transcript at any time from the session&apos;s results page.</p>
      </CardContent>
    </Card>
  )
}
