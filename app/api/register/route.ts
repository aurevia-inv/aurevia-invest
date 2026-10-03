import {NextResponse} from 'next/server';
import bcrypt from 'bcryptjs';
import {AccountMode,Prisma} from '@prisma/client';
import {z,ZodError} from 'zod';
import {db} from '@/lib/db';
import {ensureUserLedger,ensureSystemAccount} from '@/lib/ledger';
import {rateLimit} from '@/lib/rate-limit';
import {issueVerificationCode} from '@/lib/verification';
import {availableVerificationChannel,deliverVerificationCode} from '@/lib/verification-delivery';
import {verificationConfig} from '@/lib/config';

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
		rateLimit(`register-email:${email}`,3,3600000);
		const channel=availableVerificationChannel(p.phone||null);
		if(!channel){
			const error=process.env.NODE_ENV==='production'?'Account verification delivery is not configured. Please contact support.':'Development setup: verification delivery is not configured. Configure an email or SMS provider; no code was generated or exposed.';
			return NextResponse.json({error},{status:503});
		}
		const result=await db.$transaction(async tx=>{
			const created=await tx.user.create({data:{email,passwordHash:await bcrypt.hash(p.password,12),name:p.name,country:p.country,phone:p.phone||null,accountMode:p.accountMode,requiresRegistrationVerification:true,termsAcceptedAt:new Date()}});
			await ensureUserLedger(tx,created.id,p.accountMode);
			await ensureSystemAccount(tx,'SYSTEM:LIABILITY','Customer Funds');
			const challenge=await issueVerificationCode(tx,created);
			return {user:created,challenge};
		});
		const delivered=await deliverVerificationCode(result.challenge.channel,result.user,result.challenge.code);
		if(!delivered){
			await db.verificationCode.updateMany({where:{userId:result.user.id},data:{resendAfter:new Date()}});
			return NextResponse.json({error:'Verification delivery could not be completed. No code was sent. Request a replacement code or contact support.',verificationPending:true,channel:result.challenge.channel.toLowerCase(),resendAfterSeconds:0},{status:503});
		}
		return NextResponse.json({message:'If this account can be created, verification instructions have been sent.',channel:result.challenge.channel.toLowerCase(),resendAfterSeconds:verificationConfig.resendCooldownSeconds},{status:202});
	}catch(error){
		if(error instanceof ZodError)return NextResponse.json({error:'Check the registration details and password requirements.'},{status:400});
		if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return NextResponse.json({message:'If this account can be created, verification instructions have been sent.',resendAfterSeconds:verificationConfig.resendCooldownSeconds},{status:202});
		if(error instanceof Error&&error.message==='RATE_LIMITED')return NextResponse.json({error:'Too many registration attempts. Try again later.'},{status:429});
		return NextResponse.json({error:'Registration is temporarily unavailable.'},{status:500});
	}
}
