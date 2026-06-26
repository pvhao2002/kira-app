import {Routes} from '@angular/router';
import {About} from './components/about/about';
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
import {SoccerHub} from './components/soccer-hub/soccer-hub';
import {CrawlDates} from './components/crawl-dates/crawl-dates';
import {Teams} from './components/teams/teams';
import {EventDataIssue} from './components/event-data-issue/event-data-issue';
import {EventCrawlFailed} from './components/event-crawl-failed/event-crawl-failed';
import {EventsHistory} from './components/events-history/events-history';
import {Statistics} from './components/statistics/statistics';
import {EventProcessMq} from './components/event-process-mq/event-process-mq';
import {TuViBeNgoc} from './components/tu-vi-be-ngoc/tu-vi-be-ngoc';
import {TuViPvhao} from './components/tu-vi-pvhao/tu-vi-pvhao';
import {PublicPlan} from './components/public-plan/public-plan';
import {authGuard} from './guards/auth.guard';
import {roleGuard} from './guards/role.guard';

const adminOnly = {canActivate: [roleGuard], data: {roles: ['admin'] as const}};

export const routes: Routes = [
  {path: '', component: About, pathMatch: 'full'},
  {path: 'login', component: Login},
  {path: 'plan', component: PublicPlan},
  {path: 'tu-vi/be-ngoc', component: TuViBeNgoc},
  {path: 'tu-vi/pvhao', component: TuViPvhao},
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {path: 'dashboard', component: Dashboard},
      {path: 'matches', component: Matches, ...adminOnly},
      {path: 'match/:id', component: MatchDetail, ...adminOnly},
      {path: 'results', component: Results, ...adminOnly},
      {path: 'cards', component: Cards},
      {path: 'cards/add', component: AddCard},
      {path: 'cards/:creditCardId/payments', component: CardPayments},
      {path: 'profile', component: Profile},
      {path: 'transactions', component: Transactions, ...adminOnly},
      {path: 'tool', component: Tools, ...adminOnly},
      {path: 'transactions/add', component: AddTransaction, ...adminOnly},
      {path: 'leagues', component: Leagues, ...adminOnly},
      {path: 'notifications', component: Notifications, ...adminOnly},
      {path: 'users', component: Users, ...adminOnly},
      {path: 'soccer', component: SoccerHub, ...adminOnly},
      {path: 'crawl-dates', component: CrawlDates, ...adminOnly},
      {path: 'event-data-issue', component: EventDataIssue, ...adminOnly},
      {path: 'event-crawl-failed', component: EventCrawlFailed, ...adminOnly},
      {path: 'event-process-mq', component: EventProcessMq, ...adminOnly},
      {path: 'events-history', component: EventsHistory, ...adminOnly},
      {path: 'teams', component: Teams, ...adminOnly},
      {path: 'statistics', component: Statistics, ...adminOnly},
    ]
  },
  {path: '**', redirectTo: ''},
];
