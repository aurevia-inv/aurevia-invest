'use client';
import Link from 'next/link';
import Image from 'next/image';
import {useSession,signOut} from 'next-auth/react';
import {usePathname} from 'next/navigation';
import {LogOut,LayoutDashboard,LineChart,Wallet,ShieldCheck,Settings,Menu,X,UserRound,ArrowUpRight} from 'lucide-react';
import {useEffect,useState} from 'react';

export default function Nav(){
 const {data}=useSession(); const pathname=usePathname(); const [open,setOpen]=useState(false);
 const close=()=>setOpen(false);
 const active=(href:string)=>pathname===href||pathname.startsWith(`${href}/`);
 useEffect(()=>{setOpen(false)},[pathname]);
 return <header className="site-nav"><div className="nav-inner">
   <Link href="/" className="brand" onClick={close}><Image src="/aurevia-logo.png" alt="Aurevia Invest" width={38} height={38}/><span>AUREVIA <b>INVEST</b></span></Link>
   <button className="menu-button" type="button" aria-label={open?'Close navigation':'Open navigation'} aria-expanded={open} aria-controls="primary-navigation" onClick={()=>setOpen(!open)}>{open?<X aria-hidden="true"/>:<Menu aria-hidden="true"/>}</button>
  <nav id="primary-navigation" aria-label="Primary navigation" className={`nav-links ${open?'nav-open':''}`} onKeyDown={event=>{if(event.key==='Escape')close()}}>
   {data?.user ? <>
     <Link href="/" onClick={close} aria-current={pathname==='/'?'page':undefined}>Home</Link>
     <Link href="/dashboard" onClick={close} aria-current={active('/dashboard')?'page':undefined}><LayoutDashboard size={15} aria-hidden="true"/>Dashboard</Link>
    <Link href="/markets" onClick={close} aria-current={active('/markets')?'page':undefined}><LineChart size={15} aria-hidden="true"/>Markets</Link>
     <Link href="/trade" onClick={close} aria-current={active('/trade')?'page':undefined}><ActivityIcon/>Trade</Link>
     <Link href="/wallet" onClick={close} aria-current={active('/wallet')?'page':undefined}><Wallet size={15} aria-hidden="true"/>Wallet</Link>
     <Link href="/kyc" onClick={close} aria-current={active('/kyc')?'page':undefined}><ShieldCheck size={15} aria-hidden="true"/>Verification</Link>
     <Link href="/settings" onClick={close} aria-current={active('/settings')?'page':undefined}><Settings size={15} aria-hidden="true"/>Settings</Link>
     {data.user.role==='ADMIN'&&<Link href="/admin" onClick={close} aria-current={active('/admin')?'page':undefined}>Admin</Link>}
     <button type="button" className="nav-logout" onClick={()=>{close();void signOut({callbackUrl:'/login'});}}><LogOut size={15} aria-hidden="true"/>Logout</button>
  </> : <><Link href="/" onClick={close} aria-current={pathname==='/'?'page':undefined}>Home</Link><Link href="/markets" onClick={close} aria-current={active('/markets')?'page':undefined}><LineChart size={15} aria-hidden="true"/>Markets</Link><Link href="/#platform" onClick={close}>Platform</Link><Link href="/education" onClick={close} aria-current={active('/education')?'page':undefined}>Education</Link><Link href="/about" onClick={close} aria-current={active('/about')?'page':undefined}>About</Link><Link href="/support" onClick={close} aria-current={active('/support')?'page':undefined}>Support</Link><Link href="/login" onClick={close}><UserRound size={15} aria-hidden="true"/>Login</Link><Link href="/register" className="nav-cta" onClick={close}>Open account <ArrowUpRight size={14} aria-hidden="true"/></Link></>}
   </nav>
 </div></header>
}

function ActivityIcon(){return <LineChart size={15} aria-hidden="true"/>}
