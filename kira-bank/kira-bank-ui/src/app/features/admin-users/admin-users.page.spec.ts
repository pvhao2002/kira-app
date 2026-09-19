import {ComponentFixture, TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {ApiService} from '../../core/services/api.service';
import {AuthStore} from '../../core/auth/auth.store';
import {LanguageService} from '../../core/i18n/language.service';
import {AdminUsersPage} from './admin-users.page';

describe('AdminUsersPage', () => {
  let fixture: ComponentFixture<AdminUsersPage>;
  let component: AdminUsersPage;
  let api: {page: ReturnType<typeof vi.fn>};

  beforeEach(async () => {
    api = {
      page: vi.fn().mockReturnValue(of({
        data: [],
        meta: {page: 0, size: 20, totalElements: 0, totalPages: 0}
      }))
    };

    await TestBed.configureTestingModule({
      imports: [AdminUsersPage],
      providers: [
        {provide: ApiService, useValue: api},
        {provide: AuthStore, useValue: {admin: () => true}},
        {provide: LanguageService, useValue: {t: (key: string) => key}}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsersPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('submits the current search input to the users endpoint', () => {
    const input = fixture.nativeElement.querySelector('form.search input') as HTMLInputElement;
    input.value = 'admin@kira.local';

    component.applySearch();

    expect(api.page).toHaveBeenLastCalledWith('admin/users', 0, 20, 'admin@kira.local');
  });
});
