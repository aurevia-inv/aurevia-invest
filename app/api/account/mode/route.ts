import {NextResponse} from 'next/server';
import {z} from 'zod';
import {AccountMode} from '@prisma/client';
import {requireUser} from '@/lib/auth';
import {db} from '@/lib/db';

const schema=z.object({accountMode:z.nativeEnum(AccountMode)});

export async function PATCH(req:Request){
	try{
		const user=await requireUser();
		const {accountMode}=schema.parse(await req.json());
		const updated=await db.user.update({where:{id:user.id},data:{accountMode},select:{accountMode:true}});
		return NextResponse.json(updated);
	}catch{
		return NextResponse.json({error:'Unable to update account mode.'},{status:400});
	}
}