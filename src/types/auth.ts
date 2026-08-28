export type UserRole = "super_admin" | "admin" | "editor" | "viewer";

export type Permission =
  | "view_images"
  | "upload_images"
  | "edit_images"
  | "delete_images"
  | "manage_festivals"
  | "manage_years"
  | "manage_albums"
  | "manage_users"
  | "view_logs"
  | "manage_settings"
  | "manage_trash"
  | "review_content";

export interface PermissionDefinition {
  id: Permission;
  labelKhmer: string;
  description: string;
  category: "images" | "content" | "admin";
}

export const AVAILABLE_PERMISSIONS: PermissionDefinition[] = [
  {
    id: "view_images",
    labelKhmer: "មើលរូបភាព និងព័ត៌មានលម្អិត",
    description: "អាចចូលមើលរូបភាពក្នុងផ្ទាំងគ្រប់គ្រង",
    category: "images",
  },
  {
    id: "upload_images",
    labelKhmer: "បង្ហោះរូបភាពថ្មី",
    description: "អាច Upload រូបភាពចូលក្នុង Albums ផ្សេងៗ",
    category: "images",
  },
  {
    id: "edit_images",
    labelKhmer: "កែសម្រួលរូបភាព",
    description: "អាចកែព័ត៌មាន ចំណងជើង ឬទីតាំងរូបភាព",
    category: "images",
  },
  {
    id: "delete_images",
    labelKhmer: "លុបរូបភាព / ដាក់ចូលធុងសំរាម",
    description: "អាចលុបរូបភាព ឬផ្លាស់ទីទៅកាន់ធុងសំរាម",
    category: "images",
  },
  {
    id: "manage_festivals",
    labelKhmer: "គ្រប់គ្រងបុណ្យ",
    description: "អាចបន្ថែម កែប្រែ ឬលុបប្រភេទបុណ្យ",
    category: "content",
  },
  {
    id: "manage_years",
    labelKhmer: "គ្រប់គ្រងឆ្នាំ",
    description: "អាចបន្ថែម ឬលុបឆ្នាំក្នុងបណ្ណសារ",
    category: "content",
  },
  {
    id: "manage_albums",
    labelKhmer: "គ្រប់គ្រង Albums",
    description: "អាចបង្កើត កែសម្រួល ឬលុប Album",
    category: "content",
  },
  {
    id: "manage_trash",
    labelKhmer: "គ្រប់គ្រងធុងសំរាម (Trash)",
    description: "អាចស្តារឡើងវិញ ឬលុបចេញពីធុងសំរាម",
    category: "content",
  },
  {
    id: "manage_users",
    labelKhmer: "គ្រប់គ្រងអ្នកប្រើប្រាស់ (Users)",
    description: "អាចបង្កើត កែប្រែសិទ្ធិ ឬផ្អាកគណនី",
    category: "admin",
  },
  {
    id: "view_logs",
    labelKhmer: "មើលកំណត់ត្រាសកម្មភាព",
    description: "អាចមើល Activity Audit Logs ក្នុងប្រព័ន្ធ",
    category: "admin",
  },
  {
    id: "manage_settings",
    labelKhmer: "គ្រប់គ្រងការកំណត់ប្រព័ន្ធ",
    description: "អាចកែប្រែការកំណត់ប្រព័ន្ធ និងបណ្ណសារ",
    category: "admin",
  },
];

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: Permission[];
  status: "active" | "disabled";
  createdAt: string;
  lastLoginAt?: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
  ip?: string;
  timestamp: string;
}

export interface Session {
  token: string;
  userId: string;
  expiresAt: number;
  createdAt: string;
  userAgent?: string;
  ip?: string;
}

export interface TrashedItem {
  id: string;
  type: "festival" | "year" | "album" | "image";
  title: string;
  description?: string;
  details?: string;
  deletedAt: string;
  deletedBy?: string;
  canRestore: boolean;
  blockReason?: string;
  originalData: unknown;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  isViewer: boolean;
  hasPermission: (permission: Permission) => boolean;
}
