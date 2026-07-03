import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
const URL=process.env.NEXT_PUBLIC_SUPABASE_URL, ANON=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SR=process.env.SUPABASE_SERVICE_ROLE_KEY
const PW='VisualQA-Test-123!'
const admin=createClient(URL,SR,{auth:{autoRefreshToken:false,persistSession:false}})
async function mkUser(tag, withAudit) {
  const email=`${tag}-${Date.now()}-${Math.floor(Math.random()*1e4)}@showcase-test.dev`
  const c=createClient(URL,ANON)
  const { data:s, error }=await c.auth.signUp({email,password:PW})
  if(error) throw new Error(tag+' signup: '+error.message)
  const uid=s.user.id
  await c.from('profiles').upsert({id:uid,email,full_name:tag+' User',target_role:'Senior Product Designer',onboarding_completed:true},{onConflict:'id'})
  if (withAudit) {
    const { data:r }=await c.from('resumes').insert({user_id:uid,title:'R',raw_text:'x',parsed_json:{name:tag,experience:[{company:'V',role:'D',bullets:['b'],metrics:[]}],skills:['Figma'],education:[],projects:[]}}).select('id').single()
    await c.from('audits').insert({user_id:uid,resume_id:r.id,audit_type:'full',overall_score:84,category_scores:[{name:'Evidence strength',score:86,severity:'minor'},{name:'Role alignment',score:78,severity:'minor'},{name:'Proof strength',score:62,severity:'major'}],findings:[],recommendations:[]})
  }
  // read referral_code via service client
  const { data:prof }=await admin.from('profiles').select('referral_code,referral_count,bonus_credits').eq('id',uid).single()
  return { email, password:PW, userId:uid, code:prof.referral_code, count:prof.referral_count, bonus:prof.bonus_credits }
}
const A = await mkUser('refA', true)   // referrer + has an audit (for share test)
const B = await mkUser('refB', false)  // new user who will use A's code
writeFileSync('/tmp/showcase-uiux-final/_refcreds.json', JSON.stringify({A,B}))
console.log('A code:', A.code, '| A count/bonus:', A.count, A.bonus)
console.log('B userId:', B.userId)
