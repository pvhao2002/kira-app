/** Shared mock data, copied from the mockup's Component state. Money is integer VND. */

export interface Branch {
  id: string;
  prefix: string;
  name: string;
  short: string;
  addr: string;
  dist: string;
  hours: string;
  open: boolean;
  defaultTheme: BranchTheme;
}

export interface BranchTheme {
  primary: string;
  accent: string;
}

export const BRANCHES: Branch[] = [
  {id: 'q7', prefix: 'Q7', name: 'Quận 7 – Him Lam', short: 'Quận 7', addr: '18 Nguyễn Thị Thập, P. Tân Hưng, Q.7', dist: '1,2 km', hours: '6:00–21:00', open: true, defaultTheme: {primary: '#2e5233', accent: '#f2d98a'}},
  {id: 'q3', prefix: 'Q3', name: 'Quận 3 – Võ Văn Tần', short: 'Quận 3', addr: '122 Võ Văn Tần, P.6, Q.3', dist: '6,8 km', hours: '6:00–21:00', open: true, defaultTheme: {primary: '#9a4a2a', accent: '#f2d98a'}},
  {id: 'td', prefix: 'TD', name: 'Thủ Đức – Thảo Điền', short: 'Thủ Đức', addr: '35 Quốc Hương, P. Thảo Điền', dist: '9,5 km', hours: '6:30–20:30', open: true, defaultTheme: {primary: '#1f5a5a', accent: '#f0d58a'}},
  {id: 'bt', prefix: 'BT', name: 'Bình Thạnh – Phan Xích Long', short: 'Bình Thạnh', addr: '201 Phan Xích Long, P.7', dist: '7,1 km', hours: '6:00–21:00', open: false, defaultTheme: {primary: '#6b4a2b', accent: '#f2c46a'}},
  {id: 'dl', prefix: 'DL', name: 'Đà Lạt – Phan Đình Phùng', short: 'Đà Lạt', addr: '88 Phan Đình Phùng, P.2, Đà Lạt', dist: '300 km', hours: '5:30–20:00', open: true, defaultTheme: {primary: '#3f4f7a', accent: '#f2d98a'}}
];

export const PRIMARY_PRESETS = ['#2e5233', '#1f5a5a', '#9a4a2a', '#6b4a2b', '#3f4f7a', '#7a2e3b', '#4a5a1e', '#1f2a1c'];
export const ACCENT_PRESETS = ['#f2d98a', '#f2c46a', '#f6c9a8', '#d9e4a6', '#e9d3f0', '#cfe3f2'];

export interface Product {
  id: string;
  slug: string;
  name: string;
  cat: string;
  price: number;
  old?: number;
  unit: string;
  badge?: string;
  rating: number;
  reviews: number;
  origin: string;
  /** Caption shown in the empty image slot (the mockup has no photos). */
  ph: string;
  sold: string;
  outOfStock?: boolean;
  /** Backend product id (set for API products; mock rows have none). */
  productId?: number;
  branchId?: number;
  available?: number;
  categorySlug?: string;
}

export const SHIP_OPTIONS = [
  {name: 'Giao hàng tiêu chuẩn', fee: 25000, eta: 'Nhận vào 01–02/10'},
  {name: 'Giao hàng nhanh', fee: 45000, eta: 'Trong 2 giờ, nội thành'},
  {name: 'Nhận tại cửa hàng', fee: 0, eta: 'Sẵn sàng sau 1 giờ'}
];

export const PAY_OPTIONS = [
  {name: 'Thanh toán khi nhận hàng (COD)', short: 'COD', note: ''},
  {name: 'Chuyển khoản ngân hàng', short: 'Chuyển khoản', note: 'Quét mã VietQR sau khi đặt hàng'},
  {name: 'Ví điện tử', short: 'Ví điện tử', note: 'Nhân viên xác nhận thủ công'},
  {name: 'Thẻ / thanh toán online', short: 'Online', note: 'Nhân viên xác nhận thủ công'}
];

export const FREE_SHIP_THRESHOLD = 200000;
