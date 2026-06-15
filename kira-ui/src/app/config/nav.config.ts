export type AppRole = 'admin' | 'user';

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  roles: AppRole[];
  exact?: boolean;
}

export const MAIN_NAV_ITEMS: NavItem[] = [
  {label: 'Home', path: '/dashboard', icon: 'home', roles: ['admin', 'user'], exact: true},
  {label: 'Soccer', path: '/soccer', icon: 'sports_soccer', roles: ['admin']},
  {label: 'Credit card', path: '/cards', icon: 'credit_card', roles: ['admin', 'user']},
  {label: 'Profile', path: '/profile', icon: 'person', roles: ['admin', 'user']},
  {label: 'Users', path: '/users', icon: 'people', roles: ['admin']},
  {label: 'Tool', path: '/tool', icon: 'build', roles: ['admin']},
];
