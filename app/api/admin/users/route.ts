import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireAdmin} from '@/lib/auth';
import {db} from '@/lib/db';
const schema=z.object({userId:z.string(),status:z.enum(['ACTIVE','FROZEN']).optional(),role:z.enum(['USER','ADMIN']).optional(),kycStatus:z.enum(['PENDING','APPROVED','REJECTED']).optional()});
export async function GET(){try{await requireAdmin();return NextResponse.json(await db.user.findMany({select:{id:true,email:true,name:true,role:true,status:true,kycStatus:true,createdAt:true},orderBy:{createdAt:'desc'},take:200}));}catch{return NextResponse.json({error:'Forbidden'},{status:403})}}
export async function PATCH(req:Request){try{const admin=await requireAdmin();const p=schema.parse(await req.json());if(p.userId===admin.id&&(p.status==='FROZEN'||p.role==='USER'))throw new Error('CANNOT_DISABLE_CURRENT_ADMIN');const u=await db.user.update({where:{id:p.userId},data:{status:p.status,role:p.role,kycStatus:p.kycStatus}});await db.auditLog.create({data:{actorId:admin.id,action:'USER_UPDATE',entity:'USER',entityId:u.id,metadata:p}});return NextResponse.json(u);}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invalid request'},{status:400})}}
