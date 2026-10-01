'use client';

import {FormEvent,useEffect,useState} from 'react';
import {ArrowDownLeft,ArrowUpRight,RefreshCw,WalletCards} from 'lucide-react';
import Nav from '@/components/Nav';

type FundingRecord={id:string;type:'DEPOSIT'|'WITHDRAWAL';method:string;amount:number|string;status:string;createdAt:string};
type WalletData={balance:number|string;transactions:FundingRecord[]};
const money=(amount:number)=>`$${amount.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;

export default function WalletPage(){
	const [data,setData]=useState<WalletData>({balance:0,transactions:[]});
	const [amount,setAmount]=useState('');
	const [type,setType]=useState<'DEPOSIT'|'WITHDRAWAL'>('DEPOSIT');
	const [method,setMethod]=useState('BANK_SIM');
	const [message,setMessage]=useState('');
	const [error,setError]=useState('');
	const [loading,setLoading]=useState(true);
	const [submitting,setSubmitting]=useState(false);

	async function load(){
		try{
			const response=await fetch('/api/wallet');
			const result=await response.json();
			if(!response.ok)throw new Error(result.error||'Unable to load wallet data.');
			setData(result);
			setError('');
		}catch(exception){setError(exception instanceof Error?exception.message:'Unable to load wallet data.');}
		finally{setLoading(false);}
	}

	useEffect(()=>{void load()},[]);

	async function submit(event:FormEvent<HTMLFormElement>){
		event.preventDefault();
		if(submitting)return;
		setSubmitting(true);setMessage('');setError('');
		try{
			const response=await fetch('/api/wallet',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type,method,amount:Number(amount)})});
			const result=await response.json();
			if(!response.ok)throw new Error(result.error||'Unable to submit this request.');
			setMessage('Request submitted for administrator review. No funds move until it is approved.');
			setAmount('');
			await load();
		}catch(exception){setError(exception instanceof Error?exception.message:'Unable to submit this request.');}
		finally{setSubmitting(false);}
	}

	const pendingDeposits=data.transactions.filter(transaction=>transaction.type==='DEPOSIT'&&transaction.status==='PENDING').reduce((sum,transaction)=>sum+Number(transaction.amount),0);
	const pendingWithdrawals=data.transactions.filter(transaction=>transaction.type==='WITHDRAWAL'&&transaction.status==='PENDING').length;

	return <><Nav/><main className="account-page">
		<header className="account-heading"><div><span className="account-kicker">Wallet &amp; funding</span><h1>Account funds</h1><p>Review your ledger balance, submit a simulated funding request, and follow its review status.</p></div><span className="status-pill">USD ledger</span></header>
		<section className="wallet-balance-panel"><div className="account-kicker">Available ledger balance</div><div className="wallet-balance-value">{loading?'Loading…':money(Number(data.balance||0))}</div><p className="wallet-demo-note">Balance is derived from posted ledger entries. Pending requests do not change it.</p></section>
		<div className="account-metrics mt-3">
			<div className="account-metric"><span>Pending deposits</span><b>{money(pendingDeposits)}</b><small>Awaiting administrator review</small></div>
			<div className="account-metric"><span>Pending withdrawals</span><b>{pendingWithdrawals}</b><small>Reserved until reviewed</small></div>
			<div className="account-metric"><span>Funding methods</span><b>3</b><small>Demo simulations only</small></div>
			<div className="account-metric"><span>Recent requests</span><b>{data.transactions.length}</b><small>Most recent 100 requests</small></div>
		</div>
		<div className="account-content-grid">
			<section className="account-panel card p-5"><div className="account-panel-title"><div><h2>Funding request</h2><p className="account-panel-subtitle">Requests are not payment confirmations.</p></div><WalletCards size={18} className="gold" aria-hidden="true"/></div>
				<form onSubmit={submit} className="space-y-4">
					<label className="account-label">Request type<select className="input" value={type} onChange={event=>setType(event.target.value as 'DEPOSIT'|'WITHDRAWAL')}><option value="DEPOSIT">Deposit request</option><option value="WITHDRAWAL">Withdrawal request</option></select></label>
					<label className="account-label">Demo method<select className="input" value={method} onChange={event=>setMethod(event.target.value)}><option value="BANK_SIM">Bank transfer simulation</option><option value="CRYPTO_SIM">Crypto transfer simulation</option><option value="INTERNAL_TRANSFER">Internal transfer simulation</option></select></label>
					<label className="account-label">Amount in USD<input className="input" type="number" min="0.01" max="100000000" step="0.01" inputMode="decimal" required value={amount} onChange={event=>setAmount(event.target.value)} placeholder="0.00"/></label>
					<div className="account-callout"><ArrowDownLeft size={16}/><span>Demo only: no bank, card, custody, or blockchain provider is connected. A request changes your ledger only after administrator review.</span></div>
					<button className="btn w-full bg-gold text-black" type="submit" disabled={submitting||loading}>{submitting?'Submitting…':'Submit request'} <ArrowUpRight className="ml-1 inline" size={15}/></button>
					{message&&<p className="text-sm text-profit" role="status">{message}</p>}{error&&<p className="text-sm text-loss" role="alert">{error}</p>}
				</form>
			</section>
			<section className="account-panel card p-5"><div className="account-panel-title"><div><h2>Request history</h2><p className="account-panel-subtitle">Status reflects the latest recorded review.</p></div><button type="button" className="icon-action" aria-label="Refresh funding history" onClick={()=>{setLoading(true);void load()}}><RefreshCw size={15}/></button></div>
				{loading?<div className="account-empty" role="status">Loading funding history…</div>:data.transactions.length?<div className="account-table-wrap"><table className="account-table"><thead><tr><th>Request</th><th>Amount</th><th>Status</th></tr></thead><tbody>{data.transactions.map(transaction=><tr key={transaction.id}><td><span className="transaction-kind">{transaction.type==='DEPOSIT'?<ArrowDownLeft size={13}/>:<ArrowUpRight size={13}/>} {transaction.type}</span><small className="transaction-method">{transaction.method.replaceAll('_',' ')}</small></td><td>{money(Number(transaction.amount))}</td><td><span className="status-pill">{transaction.status}</span></td></tr>)}</tbody></table></div>:<div className="account-empty"><div><WalletCards size={22} className="mx-auto mb-3 gold"/><p>No funding requests yet.</p></div></div>}
			</section>
		</div>
	</main></>;
}
