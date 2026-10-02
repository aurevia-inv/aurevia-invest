import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {placeOrder} from '@/lib/orders';
import {jsonSafe} from '@/lib/serializers';

const schema=z.object({instrumentId:z.string().min(1),side:z.enum(['BUY','SELL']),type:z.enum(['MARKET','LIMIT','STOP']),quantity:z.number().positive(),price:z.number().positive().optional(),stopPrice:z.number().positive().optional()});
export async function GET(){try{const u=await requireUser();return NextResponse.json(jsonSafe(await db.order.findMany({where:{userId:u.id,accountMode:u.accountMode},include:{instrument:true,executions:true},orderBy:{createdAt:'desc'},take:100})));}catch{return NextResponse.json({error:'Unauthorized'},{status:401})}}
export async function POST(req:Request){try{const u=await requireUser();const p=schema.parse(await req.json());const o=await placeOrder(u.id,u.accountMode,p);return NextResponse.json(jsonSafe(o),{status:201});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Order rejected'},{status:400})}}
export async function DELETE(req:Request){try{const u=await requireUser();const {orderId}=await req.json();if(typeof orderId!=='string')return NextResponse.json({error:'orderId required'},{status:400});const o=await db.order.updateMany({where:{id:orderId,userId:u.id,accountMode:u.accountMode,status:'OPEN'},data:{status:'CANCELLED'}});if(!o.count)return NextResponse.json({error:'Order not open or not found'},{status:404});return NextResponse.json({ok:true});}catch{return NextResponse.json({error:'Unable to cancel order'},{status:400})}}
