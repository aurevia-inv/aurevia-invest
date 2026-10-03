import {NextResponse} from 'next/server';
import {AccountMode,NotificationType,SupportAuthor,SupportStatus} from '@prisma/client';
import {z,ZodError} from 'zod';
import {requireUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {jsonSafe} from '@/lib/serializers';
import {createNotification} from '@/lib/notifications';

const schema=z.discriminatedUnion('action',[
	z.object({action:z.literal('ticket'),subject:z.string().trim().min(3).max(120),message:z.string().trim().min(3).max(4000),transactionId:z.string().min(1).optional()}),
	z.object({action:z.literal('reply'),conversationId:z.string().min(1),message:z.string().trim().min(1).max(4000)}),
]);

export async function GET(){
	try{
		const user=await requireUser();
		const conversations=await db.supportConversation.findMany({where:{userId:user.id,accountMode:user.accountMode},include:{transaction:{select:{id:true,type:true,status:true,amount:true,currency:true}},messages:{orderBy:{createdAt:'asc'},select:{id:true,authorType:true,body:true,createdAt:true}}},orderBy:{lastMessageAt:'desc'}});
		return NextResponse.json(jsonSafe(conversations));
	}catch{
		return NextResponse.json({error:'Unauthorized'},{status:401});
	}
}

export async function POST(req:Request){
	try{
		const user=await requireUser();
		const input=schema.parse(await req.json());
		if(input.action==='ticket'){
			const transactionId=input.transactionId||null;
			if(transactionId){
				const transaction=await db.fundingRequest.findFirst({where:{id:transactionId,userId:user.id,accountMode:user.accountMode},select:{id:true}});
				if(!transaction)return NextResponse.json({error:'Transaction not found.'},{status:404});
			}
			const conversation=await db.$transaction(async tx=>{
				const created=await tx.supportConversation.create({data:{userId:user.id,accountMode:user.accountMode,subject:input.subject,transactionId,status:SupportStatus.AWAITING_ADMIN,messages:{create:{authorType:SupportAuthor.USER,authorId:user.id,body:input.message}}},include:{messages:true}});
				await createNotification(tx,{userId:user.id,type:NotificationType.SUPPORT,title:'Support request sent to admin',message:`Your support conversation “${created.subject}” is awaiting an administrator response.`,dedupeKey:`support:${created.id}:created`,relatedEntity:'SUPPORT',relatedId:created.id,actionUrl:'/support'});
				return created;
			});
			return NextResponse.json(jsonSafe(conversation),{status:201});
		}
		const conversation=await db.supportConversation.findFirst({where:{id:input.conversationId,userId:user.id,accountMode:user.accountMode}});
		if(!conversation)return NextResponse.json({error:'Conversation not found.'},{status:404});
		if(conversation.status===SupportStatus.RESOLVED)return NextResponse.json({error:'This conversation is resolved.'},{status:409});
		const updated=await db.$transaction(async tx=>{
			const message=await tx.supportMessage.create({data:{conversationId:conversation.id,authorType:SupportAuthor.USER,authorId:user.id,body:input.message}});
			const changed=await tx.supportConversation.update({where:{id:conversation.id},data:{status:SupportStatus.AWAITING_ADMIN,lastMessageAt:new Date()}});
			await createNotification(tx,{userId:user.id,type:NotificationType.SUPPORT,title:'Support ticket updated',message:'Your reply was added to the support conversation.',dedupeKey:`support:${conversation.id}:message:${message.id}`,relatedEntity:'SUPPORT',relatedId:conversation.id,actionUrl:'/support'});
			return changed;
		});
		return NextResponse.json(jsonSafe(updated));
	}catch(error){
		if(error instanceof ZodError)return NextResponse.json({error:'Check the ticket details and message.'},{status:400});
		return NextResponse.json({error:'Unable to save the support request.'},{status:400});
	}
}