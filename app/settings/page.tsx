'use client';

import {FormEvent,useEffect,useState} from 'react';
import {Bell,Check,KeyRound,ShieldCheck,UserRound} from 'lucide-react';
import Nav from '@/components/Nav';

type Profile={id:string;email:string;name:string|null;phone:string|null;country:string|null;twoFactorEnabled:boolean;role:'USER'|'ADMIN';status:string;kycStatus:string};

export default function Settings(){
	const [profile,setProfile]=useState<Profile|null>(null);
	const [section,setSection]=useState<'profile'|'security'|'preferences'>('profile');
	const [message,setMessage]=useState('');
	const [error,setError]=useState('');
	const [loading,setLoading]=useState(true);
	const [saving,setSaving]=useState(false);

	useEffect(()=>{
		let active=true;
		fetch('/api/profile').then(async response=>{
			const result=await response.json();
			if(!response.ok)throw new Error(result.error||'Unable to load your profile.');
			if(active)setProfile(result);
		}).catch(exception=>{if(active)setError(exception instanceof Error?exception.message:'Unable to load your profile.')}).finally(()=>{if(active)setLoading(false)});
		return()=>{active=false};
	},[]);

	async function save(event:FormEvent<HTMLFormElement>){
		event.preventDefault();
		if(!profile||saving)return;
		setSaving(true);setMessage('');setError('');
		try{
			const response=await fetch('/api/profile',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:profile.name,phone:profile.phone,country:profile.country,twoFactorEnabled:profile.twoFactorEnabled})});
			const result=await response.json();
			if(!response.ok)throw new Error(result.error||'Unable to save profile.');
			setProfile(result);setMessage('Profile saved.');
		}catch(exception){setError(exception instanceof Error?exception.message:'Unable to save profile.')}
		finally{setSaving(false)}
	}

	const verification=profile?.kycStatus==='APPROVED'?'Approved':profile?.kycStatus==='REJECTED'?'Needs attention':'Pending';

	return <><Nav/><main className="account-page">
		<header className="account-heading"><div><span className="account-kicker">Account center</span><h1>Settings</h1><p>Manage your profile and review the security state supported by this account.</p></div><span className="status-pill">{loading?'Loading':profile?.status||'Unavailable'}</span></header>
		<div className="settings-layout">
			<nav className="settings-tabs" aria-label="Settings sections" role="tablist">
				<button type="button" role="tab" aria-selected={section==='profile'} className={section==='profile'?'is-active':''} onClick={()=>setSection('profile')}><UserRound size={16}/>Profile</button>
				<button type="button" role="tab" aria-selected={section==='security'} className={section==='security'?'is-active':''} onClick={()=>setSection('security')}><KeyRound size={16}/>Security</button>
				<button type="button" role="tab" aria-selected={section==='preferences'} className={section==='preferences'?'is-active':''} onClick={()=>setSection('preferences')}><Bell size={16}/>Preferences</button>
			</nav>
			<div className="settings-content">
				{section==='profile'&&<section className="account-panel card p-5" role="tabpanel"><div className="account-panel-title"><div><h2>Personal profile</h2><p className="account-panel-subtitle">Update the information associated with your account.</p></div><UserRound size={18} className="gold" aria-hidden="true"/></div>
					{profile&&<form onSubmit={save} className="account-form-grid">
						<label className="account-label md:col-span-2">Email address<input className="input" type="email" autoComplete="email" value={profile.email} disabled/></label>
						<label className="account-label">Name<input className="input" autoComplete="name" required minLength={2} maxLength={120} value={profile.name||''} onChange={event=>setProfile({...profile,name:event.target.value})}/></label>
						<label className="account-label">Phone<input className="input" type="tel" autoComplete="tel" maxLength={40} value={profile.phone||''} onChange={event=>setProfile({...profile,phone:event.target.value})}/></label>
						<label className="account-label">Country<input className="input" autoComplete="country-name" required minLength={2} maxLength={80} value={profile.country||''} onChange={event=>setProfile({...profile,country:event.target.value})}/></label>
						<div className="account-callout md:col-span-2"><ShieldCheck size={16}/><span>Verification status: <b>{verification}</b>. Review your details on the <a className="gold" href="/kyc">Verification page</a>.</span></div>
						<div className="md:col-span-2"><button type="submit" className="btn bg-gold text-black" disabled={saving||loading}>{saving?'Saving…':'Save profile'}</button>{message&&<p className="mt-3 text-sm text-profit" role="status">{message}</p>}{error&&<p className="mt-3 text-sm text-loss" role="alert">{error}</p>}</div>
					</form>}
					{loading&&!profile&&<div className="account-empty" role="status">Loading profile…</div>}
				</section>}
				{section==='security'&&<section className="account-panel card p-5" role="tabpanel"><div className="account-panel-title"><div><h2>Security overview</h2><p className="account-panel-subtitle">Review current account flags and session capabilities.</p></div><ShieldCheck size={18} className="gold" aria-hidden="true"/></div>
					<div className="security-row"><span className="security-icon"><Check size={16}/></span><div><b>Password sign-in</b><p>Credential authentication is enabled for this account.</p></div><span className="status-pill">Enabled</span></div>
					<div className="security-row"><span className="security-icon"><KeyRound size={16}/></span><div><b>Two-factor flag</b><p>This account field is a simulation only; no TOTP, WebAuthn, recovery codes, or second challenge is configured.</p></div><span className="status-pill">{profile?.twoFactorEnabled?'Flag on':'Not enabled'}</span></div>
					<div className="security-row"><span className="security-icon"><UserRound size={16}/></span><div><b>Session management</b><p>Sessions are controlled by the secure sign-in cookie and server-side session configuration.</p></div><span className="status-pill">Current session</span></div>
					<div className="account-callout mt-4"><Bell size={16}/><span>Notification controls and a session/device list are not enabled in this version.</span></div>
				</section>}
				{section==='preferences'&&<section className="account-panel card p-5" role="tabpanel"><div className="account-panel-title"><div><h2>Preferences</h2><p className="account-panel-subtitle">More account controls will appear here when they are connected.</p></div><Bell size={18} className="gold" aria-hidden="true"/></div><div className="account-empty">Notification delivery and display preferences are not configured.</div></section>}
			</div>
		</div>
	</main></>;
}
