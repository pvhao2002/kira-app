import {join} from 'node:path';

export function resolveAiscoreUserDataDir(api: string): string {
    const port = process.env.PORT ?? '3000';
    return join(process.cwd(), '.playwright', `port_${port}_${api}`);
}
