import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { firstValueFrom } from 'rxjs';
import { errorMessage, ProtoApi, protoResource } from '../core/proto-api';
import { CategoryDraftSchema, CategoryListSchema, CategorySchema, type Category } from '../gen/kira/news/v1/news_pb';

@Component({
  selector: 'news-categories-page',
  imports: [FormsModule, HlmButton, HlmInput, HlmLabel, HlmTableImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="font-serif text-2xl font-bold">Chuyên mục</h1>
    <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div hlmTableContainer class="rounded-lg border border-border bg-card">
        <table hlmTable>
          <thead hlmTHead><tr hlmTr><th hlmTh>Thứ tự</th><th hlmTh>Tên</th><th hlmTh>Slug</th><th hlmTh></th></tr></thead>
          <tbody hlmTBody>
            @for (c of categories.data()?.items ?? []; track c.id) {
              <tr hlmTr>
                <td hlmTd>{{ c.sortOrder }}</td>
                <td hlmTd class="font-medium">{{ c.name }}<div class="text-xs font-normal text-muted-foreground">{{ c.description }}</div></td>
                <td hlmTd class="font-mono text-xs">{{ c.slug }}</td>
                <td hlmTd><button hlmBtn variant="ghost" size="sm" (click)="edit(c)" [attr.data-testid]="'edit-category-' + c.slug">Sửa</button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <form class="grid content-start gap-3 rounded-lg border border-border bg-card p-4" (ngSubmit)="save()" data-testid="category-form">
        <h2 class="font-semibold">{{ editingId() ? 'Sửa chuyên mục' : 'Thêm chuyên mục' }}</h2>
        <label hlmLabel for="cat-name">Tên *</label>
        <input hlmInput id="cat-name" name="name" required [(ngModel)]="name" />
        <label hlmLabel for="cat-slug">Slug (để trống = tự tạo)</label>
        <input hlmInput id="cat-slug" name="slug" [(ngModel)]="slug" />
        <label hlmLabel for="cat-desc">Mô tả</label>
        <input hlmInput id="cat-desc" name="description" [(ngModel)]="description" />
        <label hlmLabel for="cat-order">Thứ tự</label>
        <input hlmInput id="cat-order" name="sortOrder" type="number" [(ngModel)]="sortOrder" />
        @if (error()) { <p role="alert" class="text-sm text-destructive">{{ error() }}</p> }
        <div class="flex gap-2">
          <button hlmBtn type="submit" [disabled]="busy()">Lưu</button>
          @if (editingId()) { <button hlmBtn variant="outline" type="button" (click)="reset()">Hủy</button> }
        </div>
      </form>
    </div>
  `,
})
export class CategoriesPage {
  private readonly api = inject(ProtoApi);
  protected readonly categories = protoResource(CategoryListSchema, () => '/api/v1/public/categories');
  protected readonly editingId = signal<bigint | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected name = '';
  protected slug = '';
  protected description = '';
  protected sortOrder = 0;

  protected edit(category: Category): void {
    this.editingId.set(category.id);
    this.name = category.name;
    this.slug = category.slug;
    this.description = category.description;
    this.sortOrder = category.sortOrder;
  }

  protected reset(): void {
    this.editingId.set(null);
    this.name = this.slug = this.description = '';
    this.sortOrder = 0;
  }

  protected async save(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    const body = { name: this.name, slug: this.slug, description: this.description, sortOrder: Number(this.sortOrder) || 0 };
    const id = this.editingId();
    try {
      await firstValueFrom(
        id
          ? this.api.send('PUT', `/api/v1/admin/categories/${id}`, CategoryDraftSchema, body, CategorySchema)
          : this.api.send('POST', '/api/v1/admin/categories', CategoryDraftSchema, body, CategorySchema),
      );
      this.reset();
      this.categories.reload();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
