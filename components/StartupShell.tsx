'use client';
import Image from 'next/image';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
import {useEffect, useRef, useState} from 'react';

const FIRST_LOAD_MS = 8000;
const PAGE_LOAD_MS = 3000;
const STORAGE_KEY = 'aurevia-startup-seen-v1';

export default function StartupShell({children}:{children:ReactNode}){
  const pathname = usePathname();
  const firstPath = useRef(pathname);
  const [loading,setLoading] = useState(true);
  const [duration,setDuration] = useState(FIRST_LOAD_MS);

  useEffect(()=>{
    let ms = PAGE_LOAD_MS;
    try {
      const seen = sessionStorage.getItem(STORAGE_KEY) === '1';
      if(!seen){
        sessionStorage.setItem(STORAGE_KEY,'1');
        ms = FIRST_LOAD_MS;
      }
    } catch {}
    setDuration(ms);
    const timer = window.setTimeout(()=>setLoading(false),ms);
    return ()=>window.clearTimeout(timer);
  },[]);

  useEffect(()=>{
    if(pathname === firstPath.current) return;
    setLoading(true);
    setDuration(PAGE_LOAD_MS);
    const timer = window.setTimeout(()=>setLoading(false),PAGE_LOAD_MS);
    return ()=>window.clearTimeout(timer);
  },[pathname]);

  return <>
    {loading && <div className="startup-screen" role="status" aria-live="polite" aria-label="Loading Aurevia Exchange">
      <div className="startup-glow"/>
      <div className="startup-card">
        <Image src="/aurevia-logo.png" alt="Aurevia" width={128} height={128} priority className="startup-logo" />
        <div className="startup-brand">AUREVIA <span>EXCHANGE</span></div>
        <div className="startup-track"><div className="startup-progress" style={{animationDuration:`${duration}ms`}}/></div>
        <p>Preparing your secure trading environment</p>
      </div>
    </div>}
    <div className={loading ? 'app-shell app-shell--loading' : 'app-shell'}><div className="scene-depth"><div className="scene-orb scene-orb-one"/><div className="scene-orb scene-orb-two"/><div className="scene-orb scene-orb-three"/></div><div className="scene-content">{children}</div></div>
  </>;
}
