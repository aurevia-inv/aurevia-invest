import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {balance} from '@/lib/ledger';
import {jsonSafe} from '@/lib/serializers';
import {Prisma} from '@prisma/client';

const schema=z.object({type:z.enum(['DEPOSIT','WITHDRAWAL']),method:z.string().min(2).max(40),amount:z.number().positive().max(100000000)});
export async function GET(){try{const u=await requireUser();const a=await db.ledgerAccount.findUnique({where:{code:`USER:${u.id}:USD`}});const bal=a?await balance(db,a.id):0;const txs=await db.fundingRequest.findMany({where:{userId:u.id},orderBy:{createdAt:'desc'},take:100});return NextResponse.json(jsonSafe({balance:bal,transactions:txs}));}catch{return NextResponse.json({error:'Unauthorized'},{status:401})}}
export async function POST(req:Request){try{const u=await requireUser();const p=schema.parse(await req.json());const f=await db.$transaction(async tx=>{const a=await tx.ledgerAccount.findUnique({where:{code:`USER:${u.id}:USD`}});if(p.type==='WITHDRAWAL'&&a){const bal=await balance(tx,a.id);const pending=await tx.fundingRequest.aggregate({where:{userId:u.id,type:'WITHDRAWAL',status:'PENDING'},_sum:{amount:true}});const reserved=pending._sum.amount??0;if(bal.lt(new Prisma.Decimal(p.amount).plus(reserved)))throw new Error('INSUFFICIENT_AVAILABLE_BALANCE');}return tx.fundingRequest.create({data:{userId:u.id,type:p.type,method:p.method,amount:p.amount}});});return NextResponse.json(jsonSafe(f),{status:201});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invalid request'},{status:400})}}
