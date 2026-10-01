'use client';
import {FormEvent,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Nav from '@/components/Nav';

export default function Register(){
 const [p,setP]=useState({name:'',email:'',password:'',country:'',phone:''});
 const [termsAccepted,setTermsAccepted]=useState(false);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const router=useRouter();

 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy)return;
  setError('');
  setBusy(true);
  try{
   const response=await fetch('/api/register',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({...p,termsAccepted})});
   const result=await response.json().catch(()=>({}));
   if(!response.ok){setError(result.error||'Registration failed.');return;}
   router.push('/login');
  }catch{
   setError('Unable to reach the registration service. Please try again.');
  }finally{
   setBusy(false);
  }
 }

 return <><Nav/><main className="mx-auto max-w-md px-4 py-12"><div className="card p-6">
    <Image src="/aurevia-logo.png" alt="Aurevia Invest" width={58} height={58} className="mb-3"/>
  <h1 className="text-2xl font-bold">Open an account</h1>
  <p className="mt-1 muted">Create your Aurevia Invest account securely.</p>
  <form onSubmit={submit} className="mt-6 space-y-4">
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
