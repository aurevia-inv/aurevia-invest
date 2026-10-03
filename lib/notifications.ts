import {NotificationType,Prisma,PrismaClient} from '@prisma/client';

type NotificationStore=PrismaClient|Prisma.TransactionClient;

export async function createNotification(tx:NotificationStore,input:{
	userId:string;
	type:NotificationType;
	title:string;
	message:string;
	dedupeKey:string;
	actionUrl?:string;
	relatedEntity?:string;
	relatedId?:string;
}){
	return tx.notification.upsert({
		where:{dedupeKey:input.dedupeKey},
		update:{},
		create:input,
	});
}