import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
const { A } = JSON.parse(readFileSync('/tmp/showcase-uiux-final/_refcreds.json','utf8'))
// A's audit + its share_token
const { data:audits } = await admin.from('audits').select('id, overall_score, share_token').eq('user_id', A.userId)
console.log('A audits:', JSON.stringify(audits))
// look up by the token that was returned
const token='d00e4f1616ed7b5a707773d1'
const { data:byTok } = await admin.from('audits').select('id, overall_score, share_token').eq('share_token', token)
console.log('by token', token, ':', JSON.stringify(byTok))
