import {Component, computed, inject, signal} from '@angular/core';
import {Router} from '@angular/router';
import {AuthService} from '../../config/AuthService';

@Component({
  selector: 'app-profile',
  imports: [],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  standalone: true
})
export class Profile {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly avatarLoadFailed = signal(false);

  readonly user = this.authService.user;
  readonly avatarUrl = computed(() => {
    const currentUser = this.user();
    if (!currentUser) {
      return this.getFallbackAvatar('User');
    }
    if (this.avatarLoadFailed()) {
      return this.getFallbackAvatar(currentUser.username);
    }
    const avatar = currentUser.avatar?.trim();
    return avatar ? avatar : this.getFallbackAvatar(currentUser.username);
  });

  onAvatarError(): void {
    this.avatarLoadFailed.set(true);
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        void this.router.navigate(['/login']);
      },
      error: () => {
        this.authService.clearSession();
        void this.router.navigate(['/login']);
      }
    });
  }

  private getFallbackAvatar(seed: string): string {
    return `https://ui-avatars.com/api/?background=1e293b&color=ffffff&name=${encodeURIComponent(seed)}`;
  }
}
