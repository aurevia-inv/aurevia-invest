import {NextResponse} from 'next/server';import {getMarket} from '@/lib/market';import {jsonSafe} from '@/lib/serializers';

export const dynamic='force-dynamic';

export async function GET(){return NextResponse.json(jsonSafe(await getMarket()),{headers:{'Cache-Control':'no-store'}});}
