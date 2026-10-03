import {NextResponse} from 'next/server';
import {Prisma,FundingStatus,FundingType,NotificationType} from '@prisma/client';
import {z,ZodError} from 'zod';
import {requireUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {balance} from '@/lib/ledger';
import {jsonSafe} from '@/lib/serializers';
import {createNotification} from '@/lib/notifications';

const schema=z.object({
	type:z.nativeEnum(FundingType),
	paymentMethodId:z.string().min(1),
	amount:z.number().positive().max(100000000),
	currency:z.string().trim().regex(/^[A-Za-z]{3,10}$/),
	transactionReference:z.string().trim().max(180).optional(),
	referenceInfo:z.string().trim().max(500).optional(),
	senderInfo:z.string().trim().max(300).optional(),
	destinationInfo:z.string().trim().max(500).optional(),
	beneficiaryInfo:z.string().trim().max(300).optional(),
	network:z.string().trim().max(80).optional(),
	note:z.string().trim().max(500).optional(),
});

const reservingStatuses=[FundingStatus.PENDING,FundingStatus.PENDING_REVIEW,FundingStatus.PROCESSING];

export async function GET(){
	try{
		const user=await requireUser();
		const [accounts,transactions]=await Promise.all([
			db.ledgerAccount.findMany({where:{userId:user.id,accountMode:user.accountMode},orderBy:{currency:'asc'}}),
			db.fundingRequest.findMany({where:{userId:user.id,accountMode:user.accountMode},orderBy:{createdAt:'desc'},take:100,include:{paymentMethod:{select:{id:true,name:true}}}}),
		]);
		const balances=await Promise.all(accounts.map(async account=>({currency:account.currency,balance:await balance(db,account.id)})));
		const usdBalance=balances.find(item=>item.currency==='USD')?.balance??new Prisma.Decimal(0);
		return NextResponse.json(jsonSafe({accountMode:user.accountMode,balance:usdBalance,balances,transactions}));
	}catch{
		return NextResponse.json({error:'Unauthorized'},{status:401});
	}
}

export async function POST(req:Request){
	try{
		const user=await requireUser();
		const parsed=schema.parse(await req.json());
		const idempotencyKey=req.headers.get('Idempotency-Key');
		if(!idempotencyKey||idempotencyKey.length>128)return NextResponse.json({error:'A valid idempotency key is required.'},{status:400});
		const currency=parsed.currency.toUpperCase();
		const reviewedUser=await db.user.findUnique({where:{id:user.id},select:{kycStatus:true}});
		if(user.accountMode==='REAL'&&reviewedUser?.kycStatus!=='APPROVED')return NextResponse.json({error:'Complete identity verification before submitting real-account funding requests.'},{status:403});

		const result=await db.$transaction(async tx=>{
			const duplicate=await tx.fundingRequest.findUnique({where:{idempotencyKey}});
			if(duplicate){
				if(duplicate.userId!==user.id||duplicate.accountMode!==user.accountMode||duplicate.type!==parsed.type||!duplicate.amount.equals(parsed.amount)||duplicate.currency!==currency||duplicate.paymentMethodId!==parsed.paymentMethodId)throw new Error('IDEMPOTENCY_KEY_REUSED');
				return {request:duplicate,replay:true};
			}
			const method=await tx.paymentMethod.findUnique({where:{id:parsed.paymentMethodId}});
			const methodEnabled=!!method?.enabled&&(parsed.type==='DEPOSIT'?method.depositEnabled:method.withdrawalEnabled);
			const correctMode=method?.demoOnly===(user.accountMode==='DEMO');
			if(!method||!methodEnabled||!method.currencies.includes(currency)||!correctMode)throw new Error('PAYMENT_METHOD_UNAVAILABLE');
			const amount=new Prisma.Decimal(parsed.amount);
			if(amount.lt(method.minimumAmount)||(method.maximumAmount&&amount.gt(method.maximumAmount)))throw new Error('AMOUNT_OUT_OF_RANGE');
			if(parsed.type==='DEPOSIT'&&!method.demoOnly&&!method.destination&&!method.instructions)throw new Error('PAYMENT_INSTRUCTIONS_UNAVAILABLE');
			if(parsed.type==='WITHDRAWAL'){
				if(!method.demoOnly&&!parsed.destinationInfo)throw new Error('WITHDRAWAL_DESTINATION_REQUIRED');
				if(!method.demoOnly&&method.requiresNetwork&&!parsed.network)throw new Error('WITHDRAWAL_NETWORK_REQUIRED');
				const code=`USER:${user.id}:${user.accountMode}:${currency}`;
				const account=await tx.ledgerAccount.findUnique({where:{code}});
				const currentBalance=account?await balance(tx,account.id):new Prisma.Decimal(0);
				const pending=await tx.fundingRequest.aggregate({where:{userId:user.id,accountMode:user.accountMode,currency,type:FundingType.WITHDRAWAL,status:{in:reservingStatuses}},_sum:{amount:true}});
				const reserved=pending._sum.amount??new Prisma.Decimal(0);
				if(currentBalance.lt(amount.plus(reserved)))throw new Error('INSUFFICIENT_AVAILABLE_BALANCE');
			}
			const request=await tx.fundingRequest.create({data:{
				userId:user.id,
				type:parsed.type,
				method:method.name,
				amount,
				currency,
				status:FundingStatus.PENDING_REVIEW,
				accountMode:user.accountMode,
				paymentMethodId:method.id,
				idempotencyKey,
				transactionReference:parsed.transactionReference||null,
				referenceInfo:parsed.referenceInfo||null,
				senderInfo:parsed.senderInfo||null,
				destinationInfo:method.demoOnly?null:parsed.type==='DEPOSIT'?method.destination:parsed.destinationInfo,
				beneficiaryInfo:parsed.beneficiaryInfo||null,
				network:parsed.network||null,
				note:parsed.note||null,
			}});
			await tx.auditLog.create({data:{actorId:user.id,action:'FUNDING_SUBMITTED',entity:'FUNDING',entityId:request.id,metadata:{type:request.type,accountMode:request.accountMode,currency:request.currency,amount:request.amount.toString()}}});
			const notificationType=request.type===FundingType.DEPOSIT?NotificationType.DEPOSIT:NotificationType.WITHDRAWAL;
			await createNotification(tx,{userId:user.id,type:notificationType,title:`${request.type==='DEPOSIT'?'Deposit':'Withdrawal'} submitted`,message:`Your ${request.type.toLowerCase()} request is pending administrator review. No transfer has been confirmed.`,dedupeKey:`funding:${request.id}:submitted`,relatedEntity:'FUNDING',relatedId:request.id,actionUrl:`/wallet/transactions/${request.id}`});
			return {request,replay:false};
		},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
		return NextResponse.json(jsonSafe(result.request),{status:result.replay?200:201});
	}catch(error){
		if(error instanceof ZodError)return NextResponse.json({error:'Check the funding details and try again.'},{status:400});
		if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return NextResponse.json({error:'This submission was already received.'},{status:409});
		const known=['IDEMPOTENCY_KEY_REUSED','PAYMENT_METHOD_UNAVAILABLE','AMOUNT_OUT_OF_RANGE','PAYMENT_INSTRUCTIONS_UNAVAILABLE','WITHDRAWAL_DESTINATION_REQUIRED','WITHDRAWAL_NETWORK_REQUIRED','INSUFFICIENT_AVAILABLE_BALANCE'];
		if(error instanceof Error&&known.includes(error.message))return NextResponse.json({error:error.message.replaceAll('_',' ').toLowerCase()},{status:error.message==='IDEMPOTENCY_KEY_REUSED'?409:400});
		return NextResponse.json({error:'Unable to submit this funding request.'},{status:500});
	}
}