'use client';
import {useEffect,useState} from 'react';
import {LineChart,Line,XAxis,YAxis,Tooltip,ResponsiveContainer} from 'recharts';
type P={t:number;p:number};
export default function PriceChart({price}:{price:number}){const [data,setData]=useState<P[]>([]);useEffect(()=>setData(d=>[...d.slice(-39),{t:Date.now(),p:price}]),[price]);return <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><XAxis dataKey="t" hide/><YAxis domain={['auto','auto']} tick={{fill:'#aaa'}} width={70}/><Tooltip formatter={(v)=>Number(v).toLocaleString(undefined,{maximumFractionDigits:6})}/><Line type="monotone" dataKey="p" dot={false} strokeWidth={2}/></LineChart></ResponsiveContainer></div>}
