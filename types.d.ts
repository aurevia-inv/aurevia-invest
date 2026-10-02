import 'next-auth';declare module 'next-auth'{interface User{id:string;role:'USER'|'ADMIN';accountMode:'DEMO'|'REAL'}interface Session{user:{id:string;role:'USER'|'ADMIN';accountMode:'DEMO'|'REAL';name?:string|null;email?:string|null}}}
declare module 'next-auth/jwt'{interface JWT{id?:string;role?:'USER'|'ADMIN';accountMode?:'DEMO'|'REAL'}}
