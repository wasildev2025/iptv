export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "reseller" | "sub_reseller";
  creditBalance: number;
  language: string;
  isActive: boolean;
  createdAt: string;
}

export interface Device {
  id: string;
  appId: string;
  app: App;
  macAddress: string;
  macAddressAlt?: string;
  packageType: "yearly" | "lifetime";
  status: "active" | "expired" | "disabled" | "trial";
  activatedAt: string;
  expiresAt?: string;
  notes?: string;
  playlistUrl?: string;
  createdAt: string;
  user?: { id: string; name: string; email: string };
}

export interface App {
  id: string;
  name: string;
  slug: string;
  iconUrl: string;
  creditsYearly: number;
  creditsLifetime: number;
  isActive: boolean;
  downloaderCode?: string;
  apkUrl?: string;
  apkVersion?: string;
  packageName?: string;
  _count?: { devices: number };
}

export interface CreditPackage {
  id: string;
  credits: number;
  bonusCredits: number;
  priceUsd: number;
  priceBrl: number;
  isActive: boolean;
}

export interface CreditTransaction {
  id: string;
  type:
    | "purchase"
    | "activation"
    | "renewal"
    | "transfer_in"
    | "transfer_out"
    | "admin_adjustment";
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export interface SubReseller {
  id: string;
  email: string;
  name: string;
  creditBalance: number;
  profitMargin: number;
  isActive: boolean;
  deviceCount: number;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  details: Record<string, unknown>;
  ipAddress: string;
  createdAt: string;
}

export interface DashboardStats {
  totalDevices: number;
  activeDevices: number;
  expiredDevices: number;
  creditBalance: number;
  recentActivations: number;
  totalSubResellers: number;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "reseller" | "sub_reseller";
  creditBalance: number;
  profitMargin: number;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  parentId: string | null;
  parent?: { name: string; email: string } | null;
  _count: { devices: number; subResellers: number };
}

export interface UserStats {
  total: number;
  active: number;
  disabled: number;
  admins: number;
  resellers: number;
  subResellers: number;
}

export interface Payment {
  id: string;
  amountUsd: number;
  paymentMethod: string;
  paymentRef: string;
  status: "pending" | "completed" | "failed" | "refunded";
  createdAt: string;
  package: CreditPackage;
}
