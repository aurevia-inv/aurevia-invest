'use client';
import {FormEvent,useState} from 'react';
import {signIn} from 'next-auth/react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Nav from '@/components/Nav';

export default function Login(){
 const [identifier,setIdentifier]=useState('');
 const [password,setPassword]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const router=useRouter();

 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy)return;
  setBusy(true);
  setError('');
  try{
   const result=await signIn('credentials',{username:identifier,email:identifier,password,redirect:false});
   if(result?.ok)router.replace('/dashboard');
   else setError('Invalid credentials or inactive account.');
  }catch{
   setError('Unable to reach the authentication service. Please try again.');
  }finally{
   setBusy(false);
  }
 }

 return <><Nav/><main className="mx-auto max-w-md px-4 py-16"><div className="card p-6">
    <Image src="/aurevia-logo.png" alt="Aurevia Invest" width={58} height={58} className="mb-3"/>
  <h1 className="text-2xl font-bold">Sign in</h1>
  <p className="mt-1 muted">Access your Aurevia Invest account.</p>
  <form onSubmit={submit} className="mt-6 space-y-4">
   <label className="block"><span className="mb-1 block text-sm">Email or administrator username</span><input className="input" name="identifier" type="text" autoComplete="username" value={identifier} onChange={event=>setIdentifier(event.target.value)} required/></label>
   <label className="block"><span className="mb-1 block text-sm">Password</span><input className="input" name="password" type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required/></label>
   {error&&<p className="text-loss text-sm" role="alert">{error}</p>}
   <button type="submit" disabled={busy} className="btn w-full bg-gold text-black disabled:opacity-50">{busy?'Signing in…':'Sign in'}</button>
  </form>
  <p className="mt-5 text-sm muted">No account? <Link className="gold" href="/register">Create one</Link></p>
 </div></main></>;
}
