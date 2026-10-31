import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AuthProvider, useAuth } from './auth';
import { ErrorBox, Spinner } from './components/Badge';
import { Shell } from './components/Shell';
import { Article } from './pages/Article';
import { Ask } from './pages/Ask';
import { Library } from './pages/Library';

// Admin screens are code-split: readers never download them.
const Questions = lazy(() => import('./pages/admin/Questions'));
const Editor = lazy(() => import('./pages/admin/Editor'));
const Analytics = lazy(() => import('./pages/admin/Analytics'));
const Agents = lazy(() => import('./pages/admin/Agents'));

function AdminOnly({ children }: { children: ReactNode }) {
  const { user, ready, openAuth } = useAuth();
  if (!ready) return <Spinner />;
  if (!user)
    return (
      <div className="max-w-md mx-auto pt-space-xl text-center flex flex-col gap-space-md items-center">
        <ErrorBox message="Sign in with an admin account to open Admin Studio." />
        <button onClick={() => openAuth()} className="px-space-md py-2 bg-primary text-on-primary rounded-xl font-badge-label text-badge-label" type="button">Sign In</button>
      </div>
    );
  if (!user.isAdmin) return <ErrorBox message="Your account doesn't have Admin Studio access." />;
  return <Suspense fallback={<Spinner />}>{children}</Suspense>;
}

const NotFound = () => <div className="pt-space-xl"><ErrorBox message="Page not found." /></div>;

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: '/', element: <Library /> },
      { path: '/tracks', element: <Library /> },
      { path: '/tracks/:category', element: <Library /> },
      { path: '/articles/:slug', element: <Article /> },
      { path: '/ask', element: <Ask /> },
      { path: '/admin/questions', element: <AdminOnly><Questions /></AdminOnly> },
      { path: '/admin/editor/:id?', element: <AdminOnly><Editor /></AdminOnly> },
      { path: '/admin/analytics', element: <AdminOnly><Analytics /></AdminOnly> },
      { path: '/admin/agents', element: <AdminOnly><Agents /></AdminOnly> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
