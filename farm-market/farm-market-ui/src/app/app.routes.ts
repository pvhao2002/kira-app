import {Routes} from '@angular/router';
import {adminGuard, adminOnlyGuard, authGuard} from './core/guards';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/store-shell').then(m => m.StoreShell),
    children: [
      {path: '', title: 'Kira Farm', loadComponent: () => import('./features/storefront/home.page').then(m => m.HomePage)},
      {path: 'products', title: 'Sản phẩm', loadComponent: () => import('./features/storefront/products.page').then(m => m.ProductsPage)},
      {path: 'products/:slug', title: 'Chi tiết sản phẩm', loadComponent: () => import('./features/storefront/product-detail.page').then(m => m.ProductDetailPage)},
      {path: 'cart', title: 'Giỏ hàng', loadComponent: () => import('./features/storefront/cart.page').then(m => m.CartPage)},
      {path: 'checkout', title: 'Thanh toán', canActivate: [authGuard], loadComponent: () => import('./features/storefront/checkout.page').then(m => m.CheckoutPage)},
      {path: 'orders/:code', title: 'Đặt hàng thành công', canActivate: [authGuard], loadComponent: () => import('./features/storefront/order-success.page').then(m => m.OrderSuccessPage)},
      {
        path: 'account',
        canActivate: [authGuard],
        loadComponent: () => import('./layout/account-shell').then(m => m.AccountShell),
        children: [
          {path: '', title: 'Tài khoản', loadComponent: () => import('./features/account/profile.page').then(m => m.ProfilePage)},
          {path: 'orders', title: 'Đơn hàng của tôi', loadComponent: () => import('./features/account/orders.page').then(m => m.AccountOrdersPage)},
          {path: 'addresses', title: 'Sổ địa chỉ', loadComponent: () => import('./features/account/addresses.page').then(m => m.AddressesPage)},
          {path: 'wishlist', title: 'Sản phẩm yêu thích', loadComponent: () => import('./features/account/wishlist.page').then(m => m.WishlistPage)},
          {path: 'rewards', title: 'Điểm thưởng', loadComponent: () => import('./features/account/rewards.page').then(m => m.RewardsPage)},
          {path: 'reviews', title: 'Đánh giá của tôi', loadComponent: () => import('./features/account/reviews.page').then(m => m.ReviewsPage)}
        ]
      }
    ]
  },
  {path: 'login', title: 'Đăng nhập', loadComponent: () => import('./features/auth/login.page').then(m => m.LoginPage)},
  {path: 'forgot-password', title: 'Quên mật khẩu', loadComponent: () => import('./features/auth/forgot.page').then(m => m.ForgotPage)},
  {path: 'reset-password', title: 'Đặt lại mật khẩu', loadComponent: () => import('./features/auth/reset.page').then(m => m.ResetPage)},
  {path: 'login/otp', title: 'Xác thực OTP', loadComponent: () => import('./features/auth/otp.page').then(m => m.OtpPage)},
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./layout/admin-shell').then(m => m.AdminShell),
    children: [
      {path: '', title: 'Tổng quan', loadComponent: () => import('./features/admin/dashboard.page').then(m => m.DashboardPage)},
      {path: 'orders', title: 'Đơn hàng', loadComponent: () => import('./features/admin/orders.page').then(m => m.AdminOrdersPage)},
      {path: 'orders/:id', title: 'Chi tiết đơn hàng', loadComponent: () => import('./features/admin/order-detail.page').then(m => m.AdminOrderDetailPage)},
      {path: 'products', title: 'Sản phẩm', loadComponent: () => import('./features/admin/products.page').then(m => m.AdminProductsPage)},
      {path: 'inventory', title: 'Kho hàng', loadComponent: () => import('./features/admin/inventory.page').then(m => m.InventoryPage)},
      {path: 'customers', title: 'Khách hàng', loadComponent: () => import('./features/admin/customers.page').then(m => m.CustomersPage)},
      {path: 'promotions', title: 'Khuyến mãi', loadComponent: () => import('./features/admin/promotions.page').then(m => m.PromotionsPage)},
      {path: 'branches', title: 'Chi nhánh', loadComponent: () => import('./features/admin/branches.page').then(m => m.BranchesPage)},
      {path: 'users', title: 'Người dùng', canActivate: [adminOnlyGuard], loadComponent: () => import('./features/admin/users.page').then(m => m.UsersPage)},
      {path: 'branches/theme', title: 'Giao diện chi nhánh', canActivate: [adminOnlyGuard], loadComponent: () => import('./features/admin/branch-theme.page').then(m => m.BranchThemePage)}
    ]
  },
  {path: '**', redirectTo: ''}
];
