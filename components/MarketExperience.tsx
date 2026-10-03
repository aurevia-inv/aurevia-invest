'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {io} from 'socket.io-client';
import {useSession} from 'next-auth/react';
import {Activity,ArrowUpRight,RefreshCw,Wifi,WifiOff} from 'lucide-react';
import Nav from '@/components/Nav';
import PriceChart from '@/components/PriceChart';

type Instrument={id:string;symbol:string;name:string;baseAsset:string;quoteAsset:string;price:string|number;change?:number};
type ActivityItem={id:string;instrument:string;symbol?:string;side:'BUY'|'SELL';quantity:string|number;price:string|number;timestamp:string;createdAt?:string;accountMode:'DEMO'|'REAL';status:string};
type Connection='connecting'|'live'|'offline';

function mergeActivity(current:ActivityItem[],incoming:ActivityItem[]){
	const byId=new Map<string,ActivityItem>();
	for(const item of [...incoming,...current])byId.set(item.id,item);
	return [...byId.values()].sort((a,b)=>new Date(b.timestamp||b.createdAt||0).getTime()-new Date(a.timestamp||a.createdAt||0).getTime()).slice(0,30);
}

export default function MarketExperience(){
	const {data:session,status:sessionStatus}=useSession();
	const accountMode=sessionStatus==='authenticated'?session?.user?.accountMode||'DEMO':'DEMO';
	const [markets,setMarkets]=useState<Instrument[]>([]);
	const [activity,setActivity]=useState<ActivityItem[]>([]);
	const [selectedId,setSelectedId]=useState('');
	const [connection,setConnection]=useState<Connection>('connecting');
	const [loading,setLoading]=useState(true);
	const [error,setError]=useState('');
	const selected=markets.find(item=>item.id===selectedId)||markets[0];
	const isReal=accountMode==='REAL';
	const sortedActivity=useMemo(()=>activity.slice(0,30),[activity]);

	useEffect(()=>{
		if(sessionStatus==='loading')return;
		let active=true;
		let connected=false;
		setActivity([]);
		async function refresh(){
			try{
				const [marketResponse,activityResponse]=await Promise.all([fetch('/api/market',{cache:'no-store'}),fetch('/api/market/activity',{cache:'no-store'})]);
				if(!marketResponse.ok||!activityResponse.ok)throw new Error('Market data is temporarily unavailable.');
				const [nextMarkets,activityResult]=await Promise.all([marketResponse.json(),activityResponse.json()]);
				if(!active)return;
				setMarkets(nextMarkets);setSelectedId(current=>current||nextMarkets[0]?.id||'');setActivity(current=>mergeActivity(current,activityResult.activity));setError('');
			}catch(exception){if(active)setError(exception instanceof Error?exception.message:'Market data is temporarily unavailable.')}
			finally{if(active)setLoading(false)}
		}
		void refresh();
		const socket=io({reconnection:true,reconnectionAttempts:Infinity,reconnectionDelay:1000,reconnectionDelayMax:10000,timeout:8000});
		const onConnect=()=>{connected=true;if(active)setConnection('live')};
		const onDisconnect=()=>{connected=false;if(active)setConnection('offline')};
		const onConnectError=()=>{connected=false;if(active)setConnection('offline')};
		const onMarket=(updates:Array<{symbol:string;price:number;change:number}>)=>{if(!active)return;setMarkets(current=>current.map(item=>{const update=updates.find(value=>value.symbol===item.symbol);return update?{...item,price:update.price,change:update.change}:item}))};
		const onTrades=(events:Array<{id:string;symbol:string;side:'BUY'|'SELL';quantity:number;price:number;createdAt:string;status:string;accountMode:'DEMO'|'REAL'}>)=>{
			if(!active||isReal)return;
			const demoEvents=events.filter(event=>event.accountMode==='DEMO').map(event=>({...event,instrument:event.symbol,timestamp:event.createdAt}));
			setActivity(current=>mergeActivity(current,demoEvents));
		};
		socket.on('connect',onConnect);socket.on('disconnect',onDisconnect);socket.on('connect_error',onConnectError);socket.on('market:update',onMarket);socket.on('trade:update',onTrades);
		const poll=window.setInterval(()=>{if(!connected||isReal)void refresh()},15000);
		return()=>{active=false;window.clearInterval(poll);socket.off('connect',onConnect);socket.off('disconnect',onDisconnect);socket.off('connect_error',onConnectError);socket.off('market:update',onMarket);socket.off('trade:update',onTrades);socket.disconnect()};
	},[sessionStatus,isReal]);

	return <><Nav/><main className="account-page market-page">
		<header className="account-heading"><div><span className="account-kicker">MARKETPLACE · IN-APP PRICE FEED</span><h1>Markets</h1><p>Prices below come from Aurevia’s simulated market loop, not an external exchange feed.</p></div><div className="market-heading-status"><span className={`status-pill ${isReal?'mode-real':'mode-demo'}`}>{isReal?'REAL ACCOUNT':'DEMO ACCOUNT'}</span><span className={`market-connection is-${connection}`}><i/>{connection==='live'?'Live connection':connection==='connecting'?'Connecting':'Offline · refreshing'}</span></div></header>
		{error&&<div className="account-callout market-error"><span>{error}</span><button type="button" className="text-link" onClick={()=>window.location.reload()}><RefreshCw size={14}/> Retry</button></div>}
		<section className="account-panel card p-5"><div className="account-panel-title"><div><h2>Market overview</h2><p className="account-panel-subtitle">Enabled instruments · simulated prices · updates from the existing market service</p></div><span className="status-pill mode-demo">SIMULATED DATA</span></div>
			{loading&&!markets.length?<div className="account-empty" role="status">Loading current instruments…</div>:markets.length?<div className="market-instrument-grid">{markets.map(instrument=><button type="button" key={instrument.id} className={`market-instrument ${selected?.id===instrument.id?'is-selected':''}`} aria-pressed={selected?.id===instrument.id} onClick={()=>setSelectedId(instrument.id)}><span>{instrument.symbol}</span><b>{Number(instrument.price).toLocaleString(undefined,{maximumFractionDigits:6})}</b><small>{instrument.name}</small><em>Simulated price</em></button>)}</div>:<div className="account-empty">No enabled instruments are available right now.</div>}
		</section>
		{selected&&<section className="account-panel card p-5 mt-4"><div className="account-panel-title"><div><h2>{selected.symbol} · Price chart</h2><p className="account-panel-subtitle">In-app simulated market updates · not live exchange data</p></div><b className="market-selected-price">{Number(selected.price).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:6})} {selected.quoteAsset}</b></div><PriceChart key={selected.id} price={Number(selected.price)}/></section>}
		<section className="account-panel card p-5 mt-4"><div className="account-panel-title"><div><h2><Activity size={17} className="gold"/> LIVE MARKET ACTIVITY</h2><p className="account-panel-subtitle">Actual application execution records only. Demo events are simulated; real events are private to their owner.</p></div><Link className="text-link" href={isReal?'/wallet':'/trade'}>{isReal?'Real account activity':'Open demo trade'} <ArrowUpRight size={14}/></Link></div>
			{sortedActivity.length?<div className="market-activity-list">{sortedActivity.map(item=>{const timestamp=item.timestamp||item.createdAt||'';const symbol=item.instrument||item.symbol||'Instrument';return <article className="market-activity-item" key={item.id}><span className={`market-side is-${item.side.toLowerCase()}`}>{item.side}</span><div className="market-activity-main"><b>{symbol}</b><span>{Number(item.quantity).toLocaleString()} @ {Number(item.price).toLocaleString(undefined,{maximumFractionDigits:6})}</span></div><span className={`status-pill ${item.accountMode==='DEMO'?'mode-demo':'mode-real'}`}>{item.accountMode==='DEMO'?'Demo · simulated':'Real'}</span><span className="market-activity-status">{item.status.replaceAll('_',' ')}</span><time dateTime={timestamp} title={timestamp?new Date(timestamp).toLocaleString():undefined}>{timestamp?new Date(timestamp).toLocaleTimeString():''}</time></article>})}</div>:<div className="market-activity-empty"><Activity size={22}/><p>{loading?'Loading activity…':isReal?'No real execution records are available for this account.':'No demo executions yet. Filled demo orders will appear here.'}</p></div>}
		</section>
		{isReal&&<p className="mt-4 text-xs leading-6 muted">Real-account order execution is not connected. No real trades are submitted by this application.</p>}
	</main></>;
}