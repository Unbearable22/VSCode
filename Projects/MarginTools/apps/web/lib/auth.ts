import {cookies} from 'next/headers';
import {userBySession} from '@mt/database/security';
export async function currentUser(){return userBySession((await cookies()).get('mt_session')?.value);}
