import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { catchError, map, Observable, of, switchMap, timeout } from 'rxjs';
import { EmptySchema, ReadEventSchema, type IpInfo } from '../gen/kira/news/v1/news_pb';
import { ProtoApi } from './proto-api';
import { SITE } from './site';

type IpInfoJson = Partial<Record<keyof Omit<IpInfo, '$typeName' | '$unknown'>, string>>;

const IPINFO_CACHE = 'kn.ipinfo';
const VISITOR = 'kn.visitor';
const SESSION = 'kn.session';

/**
 * On every article view (browser only), resolve the reader with ipinfo.io and store it via the protobuf API.
 * ipinfo is called once per browser session; a failed lookup still records the read.
 */
@Injectable({ providedIn: 'root' })
export class ReadTracker {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ProtoApi);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  track(articleId: bigint): void {
    if (!this.browser) {
      return;
    }
    this.ipInfo()
      .pipe(
        switchMap((info) =>
          this.api.send(
            'POST',
            '/api/v1/public/reads',
            ReadEventSchema,
            {
              articleId,
              visitorId: id(localStorage, VISITOR),
              sessionId: id(sessionStorage, SESSION),
              ipInfo: info,
              referrer: document.referrer,
              language: navigator.language,
              screenWidth: screen.width,
              screenHeight: screen.height,
            },
            EmptySchema,
          ),
        ),
        catchError(() => of(null)), // analytics must never break reading
      )
      .subscribe();
  }

  private ipInfo(): Observable<IpInfoJson> {
    const cached = read(sessionStorage, IPINFO_CACHE);
    if (cached) {
      return of(JSON.parse(cached) as IpInfoJson);
    }
    const url = 'https://ipinfo.io/json' + (SITE.ipinfoToken ? `?token=${SITE.ipinfoToken}` : '');
    return this.http.get<Record<string, unknown>>(url).pipe(
      timeout(5000),
      map((raw) => {
        const info: IpInfoJson = {};
        for (const key of ['ip', 'hostname', 'city', 'region', 'country', 'loc', 'org', 'postal', 'timezone'] as const) {
          if (typeof raw[key] === 'string') {
            info[key] = raw[key];
          }
        }
        write(sessionStorage, IPINFO_CACHE, JSON.stringify(info));
        return info;
      }),
      catchError(() => of({})),
    );
  }
}

function id(storage: Storage, key: string): string {
  const existing = read(storage, key);
  if (existing) {
    return existing;
  }
  const created = crypto.randomUUID();
  write(storage, key, created);
  return created;
}

function read(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null; // private mode / blocked storage
  }
}

function write(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // ignore: storage unavailable
  }
}
