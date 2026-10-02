'use client';
import {FormEvent,useState} from 'react';
import {signIn,useSession} from 'next-auth/react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Nav from '@/components/Nav';

export default function Register(){
 const [p,setP]=useState<{name:string;email:string;password:string;country:string;phone:string;accountMode:'DEMO'|'REAL'}>({name:'',email:'',password:'',country:'',phone:'',accountMode:'DEMO'});
 const [termsAccepted,setTermsAccepted]=useState(false);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const router=useRouter();
 const {update}=useSession();

 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy)return;
  setError('');
  setBusy(true);
  try{
  const response=await fetch('/api/register',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({...p,termsAccepted})});
   const result=await response.json().catch(()=>({}));
   if(!response.ok){setError(result.error||'Registration failed.');return;}
  const session=await signIn('credentials',{email:p.email,password:p.password,redirect:false});
  if(session?.ok){await update();router.replace('/dashboard');router.refresh();return;}
  router.replace('/login');
  }catch{
   setError('Unable to reach the registration service. Please try again.');
  }finally{
   setBusy(false);
  }
 }

 return <><Nav/><main className="mx-auto max-w-md px-4 py-12"><div className="card p-6">
    <Image src="/aurevia-logo.png" alt="Aurevia Invest" width={58} height={58} className="mb-3"/>
  <h1 className="text-2xl font-bold">Open an account</h1>
  <p className="mt-1 muted">Choose how you want to use Aurevia Invest.</p>
  <form onSubmit={submit} className="mt-6 space-y-4">
   <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">Account type</legend>
    <label className={`block cursor-pointer rounded-lg border p-4 ${p.accountMode==='DEMO'?'border-gold/30 bg-white/5':'border-white/10'}`}><span className="flex items-center gap-3"><input type="radio" name="accountMode" value="DEMO" checked={p.accountMode==='DEMO'} onChange={()=>setP({...p,accountMode:'DEMO'})}/><span className="font-semibold">DEMO ACCOUNT</span></span><span className="mt-2 block pl-7 text-sm muted">Explore simulated markets and demo-only activity. No real funds move and demo balances never become real funds.</span></label>
    <label className={`block cursor-pointer rounded-lg border p-4 ${p.accountMode==='REAL'?'border-gold/30 bg-white/5':'border-white/10'}`}><span className="flex items-center gap-3"><input type="radio" name="accountMode" value="REAL" checked={p.accountMode==='REAL'} onChange={()=>setP({...p,accountMode:'REAL'})}/><span className="font-semibold">REAL ACCOUNT</span></span><span className="mt-2 block pl-7 text-sm muted">Real-account funding requests require identity verification and administrator review. No payment or trade is executed automatically.</span></label>
   </fieldset>
   <label className="block"><span className="mb-1 block text-sm">Full name</span><input className="input" name="name" autoComplete="name" value={p.name} onChange={event=>setP({...p,name:event.target.value})} required minLength={2} maxLength={120}/></label>
   <label className="block"><span className="mb-1 block text-sm">Email</span><input className="input" name="email" type="email" autoComplete="email" value={p.email} onChange={event=>setP({...p,email:event.target.value})} required maxLength={254}/></label>
   <label className="block"><span className="mb-1 block text-sm">Country</span><input className="input" name="country" autoComplete="country-name" value={p.country} onChange={event=>setP({...p,country:event.target.value})} required minLength={2} maxLength={80}/></label>
   <label className="block"><span className="mb-1 block text-sm">Phone (optional)</span><input className="input" name="phone" type="tel" autoComplete="tel" value={p.phone} onChange={event=>setP({...p,phone:event.target.value})} maxLength={40}/></label>
   <label className="block"><span className="mb-1 block text-sm">Password</span><input className="input" name="password" type="password" autoComplete="new-password" value={p.password} onChange={event=>setP({...p,password:event.target.value})} required minLength={10} maxLength={128} aria-describedby="password-requirements"/></label>
   <p id="password-requirements" className="muted text-xs">Use at least 10 characters, including an uppercase letter, a lowercase letter, and a number.</p>
   <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={termsAccepted} onChange={event=>setTermsAccepted(event.target.checked)} required/><span>I agree to the platform terms and risk disclosures.</span></label>
   {error&&<p className="text-loss text-sm" role="alert">{error}</p>}
   <button type="submit" disabled={busy} className="btn w-full bg-gold text-black disabled:opacity-50">{busy?'Creating account…':'Continue'}</button>
  </form>
  <p className="mt-5 text-sm muted">Already registered? <Link href="/login" className="gold">Sign in</Link></p>
 </div></main></>;
}
