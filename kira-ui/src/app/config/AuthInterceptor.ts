import {HttpInterceptorFn} from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isGatewayRequest(req.url)) {
    return next(req);
  }

  const setHeaders: Record<string, string> = {};
  if (shouldAttachCsrf(req.method) && !req.headers.has('X-XSRF-TOKEN')) {
    const token = getCookie('XSRF-TOKEN');
    if (token) {
      setHeaders['X-XSRF-TOKEN'] = token;
    }
  }

  return next(req.clone({
    withCredentials: true,
    setHeaders
  }));
};

function isGatewayRequest(url: string): boolean {
  return url.startsWith('/gateway/');
}

function shouldAttachCsrf(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

function getCookie(name: string): string | null {
  const cookieStr = document.cookie || '';
  const encodedName = `${encodeURIComponent(name)}=`;
  const cookie = cookieStr
    .split(';')
    .map(item => item.trim())
    .find(item => item.startsWith(encodedName));

  if (!cookie) {
    return null;
  }

  const value = cookie.substring(encodedName.length);
  return decodeURIComponent(value);
}
