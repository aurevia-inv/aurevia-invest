import next from 'next';
import {createServer} from 'http';
import {Server as IOServer} from 'socket.io';
import {loadEnvConfig} from '@next/env';
import {tickMarkets} from './lib/market';
import {db} from './lib/db';

loadEnvConfig(process.cwd());

const dev=process.env.NODE_ENV!=='production';
const port=Number(process.env.PORT||3000);
const app=next({dev});
const handle=app.getRequestHandler();
const publicUrl=process.env.NEXT_PUBLIC_APP_URL||process.env.NEXTAUTH_URL||`http://localhost:${port}`;

async function startServer(){
 try{
  await app.prepare();
 }catch{
  console.error('Next.js preparation failed; startup aborted');
  process.exit(1);
 }

 if(process.env.NODE_ENV==='production'&&!process.env.NEXTAUTH_SECRET){
  console.error('NEXTAUTH_SECRET is required in production');
  process.exit(1);
 }

 const http=createServer((req,res)=>handle(req,res));
 const io=new IOServer(http,{cors:{origin:publicUrl,credentials:true}});
 io.on('connection',socket=>{socket.emit('connected',{ok:true});});
 const intervalMs=Math.max(1000,Number(process.env.MARKET_TICK_MS||2500));
 let running=false;

 http.once('error',(error:NodeJS.ErrnoException)=>{
  console.error(error.code==='EADDRINUSE'?'Configured HTTP port is already in use':'HTTP server failed to start');
  process.exit(1);
 });

 http.listen(port,()=>{
  console.log('Aurevia Invest HTTP server listening');
  setInterval(async()=>{
   if(running)return;
   running=true;
   try{
    const data=await tickMarkets();
    io.emit('market:update',data);
    const recent=await db.execution.findMany({where:{createdAt:{gte:new Date(Date.now()-intervalMs-500)}},include:{order:{include:{instrument:true}}},orderBy:{createdAt:'desc'},take:100});
    if(recent.length)io.emit('trade:update',recent.map(execution=>({id:execution.id,symbol:execution.order.instrument.symbol,side:execution.order.side,quantity:Number(execution.quantity),price:Number(execution.price),fee:Number(execution.fee),createdAt:execution.createdAt})));
   }catch{
    console.error('Market tick failed');
   }finally{
    running=false;
   }
  },intervalMs);
 });
}

void startServer();
