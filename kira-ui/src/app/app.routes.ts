import {Routes} from '@angular/router';
import {Login} from './components/login/login';
import {Dashboard} from './components/dashboard/dashboard';
import {Matches} from './components/matches/matches';
import {Cards} from './components/cards/cards';
import {AddCard} from './components/add-card/add-card';
import {CardPayments} from './components/card-payments/card-payments';
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
import {SoccerHub} from './components/soccer-hub/soccer-hub';
import {CrawlDates} from './components/crawl-dates/crawl-dates';
import {Teams} from './components/teams/teams';
import {EventDataIssue} from './components/event-data-issue/event-data-issue';
import {EventCrawlFailed} from './components/event-crawl-failed/event-crawl-failed';
import {authGuard} from './guards/auth.guard';

export const routes: Routes = [
  {path: 'login', component: Login},
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {path: '', redirectTo: 'dashboard', pathMatch: 'full'},
      {path: 'dashboard', component: Dashboard},
      {path: 'matches', component: Matches},
      {path: 'match/:id', component: MatchDetail},
      {path: 'results', component: Results},
      {path: 'cards', component: Cards},
      {path: 'cards/add', component: AddCard},
      {path: 'cards/:creditCardId/payments', component: CardPayments},
      {path: 'profile', component: Profile},
      {path: 'transactions', component: Transactions},
      {path: 'tool', component: Tools},
      {path: 'transactions/add', component: AddTransaction},
      {path: 'leagues', component: Leagues},
      {path: 'notifications', component: Notifications},
      {path: 'users', component: Users},
      {path: 'sql', component: SqlEditor},
      {path: 'soccer', component: SoccerHub},
      {path: 'crawl-dates', component: CrawlDates},
      {path: 'event-data-issue', component: EventDataIssue},
      {path: 'event-crawl-failed', component: EventCrawlFailed},
      {path: 'teams', component: Teams},
    ]
  },
  {path: '**', redirectTo: 'dashboard'},
];
