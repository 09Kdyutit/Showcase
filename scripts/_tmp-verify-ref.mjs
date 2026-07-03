import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const B='https://showcase-app-three.vercel.app'
const { A, B: U } = JSON.parse(readFileSync('/tmp/showcase-uiux-final/_refcreds.json','utf8'))
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
const br=await chromium.launch()

async function login(email){ const ctx=await br.newContext(); const p=await ctx.newPage()
  await p.goto(`${B}/login`,{waitUntil:'domcontentloaded'}); await p.fill('#email',email); await p.fill('#password','VisualQA-Test-123!')
  await Promise.all([p.waitForURL('**/dashboard',{timeout:20000}).catch(()=>{}),p.click('button[type=submit]')]); await p.waitForTimeout(1200); return p }
async function post(p,path,body){ return p.evaluate(async ({path,body})=>{ const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}); let j; try{j=await r.json()}catch{j=null} return {status:r.status,j} },{path,body}) }
const readA=async()=>{ const {data}=await admin.from('profiles').select('referral_count,bonus_credits').eq('id',A.userId).single(); return data }

// 1) SHARE — as A, create share link, load public page
const pa=await login(A.email)
const share=await post(pa,'/api/audit/share')
console.log('SHARE status', share.status, 'url', share.j?.data?.url)
if (share.j?.data?.url) {
  const pg=await (await br.newContext()).newPage()
  await pg.goto(share.j.data.url,{waitUntil:'domcontentloaded'}); await pg.waitForTimeout(2000)
  await pg.screenshot({path:'/tmp/showcase-uiux-final/shared-proofscore.png'})
  const bodyText=await pg.evaluate(()=>document.body.innerText)
  console.log('  public page shows score 84?', bodyText.includes('84'))
  console.log('  public page LEAKS private findings? (should be false)', /finding|recommendation|resume text/i.test(bodyText))
  // OG image
  const og=await fetch(share.j.data.url+'/opengraph-image'); console.log('  OG image:', og.status, og.headers.get('content-type'))
}

// 2) SELF-REFERRAL (A uses own code) — must be blocked
const self=await post(pa,'/api/referral/claim',{code:A.code})
console.log('SELF-REF claimed (want false):', self.j?.data?.claimed, '| A after:', JSON.stringify(await readA()))

// 3) HAPPY PATH (B uses A's code)
const pb=await login(U.email)
const claim=await post(pb,'/api/referral/claim',{code:A.code})
console.log('HAPPY claimed (want true):', claim.j?.data?.claimed, '| A after:', JSON.stringify(await readA()))

// 4) DOUBLE-CLAIM (B claims again) — must be blocked, A unchanged
const dbl=await post(pb,'/api/referral/claim',{code:A.code})
console.log('DOUBLE claimed (want false):', dbl.j?.data?.claimed, '| A after:', JSON.stringify(await readA()))
await br.close()
