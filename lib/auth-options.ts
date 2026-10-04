import {NextAuthOptions} from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {NotificationType} from '@prisma/client';
import {db} from '@/lib/db';
import {createNotification} from '@/lib/notifications';

export const authOptions:NextAuthOptions={
  session:{strategy:'jwt',maxAge:8*60*60},
  jwt:{maxAge:8*60*60},
  pages:{signIn:'/login'},
  providers:[CredentialsProvider({
    name:'credentials',
    credentials:{
      email:{label:'Email',type:'email'},
      username:{label:'Username',type:'text'},
      password:{label:'Password',type:'password'},
      replaceSession:{label:'Replace active session',type:'text'}
    },
    async authorize(c){
      const password=c?.password;
      if(!password)return null;
      const username=(c?.username||'').trim();
      const email=(c?.email||username).trim().toLowerCase();
      const adminUsername=process.env.ADMIN_USERNAME?.trim();
      const isAdminUsername=!!username&&!!adminUsername&&username.toLowerCase()===adminUsername.toLowerCase();
      const adminEmail=process.env.ADMIN_EMAIL?.trim().toLowerCase();
      const lookupEmail=isAdminUsername ? adminEmail : email;
      if(!lookupEmail)return null;
      const u=await db.user.findUnique({where:{email:lookupEmail}});
      if(!u||u.status!=='ACTIVE'||(u.role==='USER'&&u.requiresRegistrationVerification&&!u.verifiedAt))return null;
      const ok=await bcrypt.compare(password,u.passwordHash);
      if(!ok)return null;
      if(isAdminUsername&&u.role!=='ADMIN')return null;
      if(u.activeSessionId&&c?.replaceSession!=='true')return null;
      const sessionId=randomUUID();
      const claimed=await db.user.updateMany({where:{id:u.id,activeSessionId:u.activeSessionId},data:{activeSessionId:sessionId,activeSessionUpdatedAt:new Date()}});
      if(claimed.count!==1)return null;
      return {id:u.id,email:u.email,name:u.name,role:u.role,accountMode:u.accountMode,sessionId};
    }
  })],
  callbacks:{
    async jwt({token,user}){
      if(user){token.id=user.id;token.role=user.role;token.accountMode=user.accountMode;token.sessionId=user.sessionId;}
      if(token.id){
        const current=await db.user.findUnique({where:{id:String(token.id)},select:{role:true,status:true,accountMode:true,activeSessionId:true}});
        if(!current||current.status!=='ACTIVE'||(token.sessionId&&current.activeSessionId!==token.sessionId)){token.id='';token.role=undefined;token.accountMode=undefined;token.sessionId=undefined;}
        else{token.role=current.role;token.accountMode=current.accountMode;}
      }
      return token;
    },
    async session({session,token}){if(session.user){session.user.id=String(token.id);session.user.role=token.role as 'USER'|'ADMIN';session.user.accountMode=token.accountMode as 'DEMO'|'REAL';session.user.sessionId=typeof token.sessionId==='string'?token.sessionId.slice(0,8):'legacy';}return session}
  },
  events:{
    async signIn({user}){
      if(!user.id)return;
      const bucket=Math.floor(Date.now()/300_000);
      try{
        await createNotification(db,{userId:user.id,type:NotificationType.SECURITY,title:'New sign-in',message:'A successful sign-in to your Aurevia Invest account was recorded.',dedupeKey:`security:${user.id}:signin:${bucket}`,actionUrl:'/settings#security'});
      }catch{
        console.warn('Unable to persist sign-in notification.');
      }
    },
    async signOut(message){
      const token='token' in message?message.token:undefined;
      const userId=token?.id||token?.sub;
      const sessionId=typeof token?.sessionId==='string'?token.sessionId:null;
      if(!userId||!sessionId)return;
      try{await db.user.updateMany({where:{id:String(userId),activeSessionId:sessionId},data:{activeSessionId:null,activeSessionUpdatedAt:null}});}
      catch{console.warn('Unable to clear the active account session.');}
    }
  },
};