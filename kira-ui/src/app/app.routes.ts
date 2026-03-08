import {Routes} from '@angular/router';
import {Login} from './components/login/login';
import {Dashboard} from './components/dashboard/dashboard';
import {Matches} from './components/matches/matches';
import {Cards} from './components/cards/cards';
import {AddCard} from './components/add-card/add-card';
import {Profile} from './components/profile/profile';
import {Transactions} from './components/transactions/transactions';
import {Results} from './components/results/results';
import {MatchDetail} from './components/match-detail/match-detail';
import {Tools} from './components/tools/tools';
import {AddTransaction} from './components/add-transaction/add-transaction';
import {Leagues} from './components/leagues/leagues';
import {Notifications} from './components/notifications/notifications';
import {Users} from './components/users/users';
import {SqlEditor} from './components/sql-editor/sql-editor';

export const routes: Routes = [
  {path: '', redirectTo: 'dashboard', pathMatch: 'full'},
  {path: 'login', component: Login},
  {path: 'dashboard', component: Dashboard},
  {path: 'matches', component: Matches},
  {path: 'match/:id', component: MatchDetail},
  {path: 'results', component: Results},
  {path: 'cards', component: Cards},
  {path: 'cards/add', component: AddCard},
  {path: 'profile', component: Profile},
  {path: 'transactions', component: Transactions},
  {path: 'tool', component: Tools},
  {path: 'transactions/add', component: AddTransaction},
  {path: 'leagues', component: Leagues},
  {path: 'notifications', component: Notifications},
  {path: 'users', component: Users},
  {path: 'sql', component: SqlEditor},
];
