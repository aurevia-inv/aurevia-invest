import {PrismaClient,Role,UserStatus} from '@prisma/client';
import bcrypt from 'bcryptjs';
const db=new PrismaClient();
async function main(){
 const email=process.env.ADMIN_EMAIL?.trim().toLowerCase();
 const password=process.env.ADMIN_PASSWORD;
 const username=process.env.ADMIN_USERNAME?.trim()||'Press376';
 if(!email||!password)throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD before seeding the administrator.');
 if(password.length<12)throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
 const hash=await bcrypt.hash(password,12);
 const admin=await db.user.upsert({where:{email},update:{passwordHash:hash,role:Role.ADMIN,status:UserStatus.ACTIVE,name:username},create:{email,passwordHash:hash,name:username,role:Role.ADMIN,status:UserStatus.ACTIVE}});
 for(const i of [{symbol:'AUR/USD',name:'Aurevia Dollar',baseAsset:'AUR',quoteAsset:'USD',price:100},{symbol:'BTC/USD',name:'Bitcoin / USD',baseAsset:'BTC',quoteAsset:'USD',price:65000},{symbol:'ETH/USD',name:'Ethereum / USD',baseAsset:'ETH',quoteAsset:'USD',price:3200},{symbol:'EUR/USD',name:'Euro / US Dollar',baseAsset:'EUR',quoteAsset:'USD',price:1.08}]) await db.instrument.upsert({where:{symbol:i.symbol},update:{price:i.price},create:i});
 await db.systemSetting.upsert({where:{key:'defaultLeverage'},update:{value:'1'},create:{key:'defaultLeverage',value:'1'}});
 await db.auditLog.create({data:{actorId:admin.id,action:'SEED',entity:'SYSTEM',metadata:{message:'Initial system seed'}}});
 console.log(`Administrator provisioned for username: ${username}`);
}
main().catch(error=>{console.error('Database seed failed. Check the database and required environment variables.');process.exitCode=1;}).finally(()=>db.$disconnect());
