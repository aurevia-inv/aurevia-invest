import {NextAuthOptions} from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import {db} from '@/lib/db';

export const authOptions:NextAuthOptions={
  session:{strategy:'jwt',maxAge:8*60*60},
  jwt:{maxAge:8*60*60},
  pages:{signIn:'/login'},
  providers:[CredentialsProvider({
    name:'credentials',
    credentials:{
      email:{label:'Email',type:'email'},
      username:{label:'Username',type:'text'},
      password:{label:'Password',type:'password'}
    },
    async authorize(c){
      const password=c?.password;
      if(!password)return null;
      const username=(c?.username||'').trim();
      const email=(c?.email||'').trim().toLowerCase();
      const adminUsername=(process.env.ADMIN_USERNAME||'Press376').trim();
      const isAdminUsername=!!username&&username.toLowerCase()===adminUsername.toLowerCase();
      const adminEmail=process.env.ADMIN_EMAIL?.trim().toLowerCase();
      const lookupEmail=isAdminUsername ? adminEmail : email;
      if(!lookupEmail)return null;
      const u=await db.user.findUnique({where:{email:lookupEmail}});
      if(!u||u.status!=='ACTIVE')return null;
      const ok=await bcrypt.compare(password,u.passwordHash);
      if(!ok)return null;
      if(isAdminUsername&&u.role!=='ADMIN')return null;
      return {id:u.id,email:u.email,name:u.name,role:u.role};
    }
  })],
  callbacks:{
    async jwt({token,user}){
      if(user){token.id=user.id;token.role=user.role;}
      if(token.id){
        const current=await db.user.findUnique({where:{id:String(token.id)},select:{role:true,status:true}});
        if(!current||current.status!=='ACTIVE'){token.id='';token.role=undefined;}
        else token.role=current.role;
      }
      return token;
    },
    async session({session,token}){if(session.user){session.user.id=String(token.id);session.user.role=token.role as 'USER'|'ADMIN';}return session}
  }
};