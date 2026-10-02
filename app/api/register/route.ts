import {NextResponse} from 'next/server';
import bcrypt from 'bcryptjs';
import {AccountMode,Prisma} from '@prisma/client';
import {z,ZodError} from 'zod';
import {db} from '@/lib/db';
import {ensureUserLedger,ensureSystemAccount} from '@/lib/ledger';
import {rateLimit} from '@/lib/rate-limit';

const schema=z.object({
	email:z.string().trim().email().max(254),
	password:z.string().min(10).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),
	name:z.string().trim().min(2).max(120),
	country:z.string().trim().min(2).max(80),
	phone:z.string().trim().max(40).optional().or(z.literal('')),
	accountMode:z.nativeEnum(AccountMode),
	termsAccepted:z.literal(true)
});

export async function POST(req:Request){
	try{
		rateLimit(`register:${req.headers.get('x-forwarded-for')||'unknown'}`,5,3600000);
		const p=schema.parse(await req.json());
		const email=p.email.toLowerCase();
		const user=await db.$transaction(async tx=>{
			const created=await tx.user.create({data:{email,passwordHash:await bcrypt.hash(p.password,12),name:p.name,country:p.country,phone:p.phone||null,accountMode:p.accountMode,termsAcceptedAt:new Date()}});
			await ensureUserLedger(tx,created.id,p.accountMode);
			await ensureSystemAccount(tx,'SYSTEM:LIABILITY','Customer Funds');
			return created;
		});
		return NextResponse.json({id:user.id},{status:201});
	}catch(error){
		if(error instanceof ZodError)return NextResponse.json({error:'Check the registration details and password requirements.'},{status:400});
		if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return NextResponse.json({error:'Email already registered.'},{status:409});
		if(error instanceof Error&&error.message==='RATE_LIMITED')return NextResponse.json({error:'Too many registration attempts. Try again later.'},{status:429});
		return NextResponse.json({error:'Registration is temporarily unavailable.'},{status:500});
	}
}
