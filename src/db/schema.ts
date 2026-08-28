import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  serial,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// --- CORE CONTENT TABLES ---

export const festivals = pgTable(
  "festivals",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    emoji: text("emoji").notNull(),
    accent: text("accent").notNull(),
    month: text("month").notNull(),
    description: text("description"),
    coverUrl: text("cover_url"),
    status: text("status").default("published").notNull(), // 'draft' | 'pending_review' | 'approved' | 'published' | 'trashed'
    isCustom: boolean("is_custom").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_festivals_status").on(table.status)],
);

export const years = pgTable("years", {
  year: integer("year").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const albums = pgTable(
  "albums",
  {
    id: text("id").primaryKey(),
    festivalId: text("festival_id")
      .notNull()
      .references(() => festivals.id, { onDelete: "cascade" }),
    year: integer("year")
      .notNull()
      .references(() => years.year, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location").default("វត្តពារាំង").notNull(),
    coverImage: text("cover_image"),
    photoCount: integer("photo_count").default(0).notNull(),
    status: text("status").default("published").notNull(), // 'draft' | 'pending_review' | 'approved' | 'published' | 'trashed'
    viewsCount: integer("views_count").default(0).notNull(),
    likesCount: integer("likes_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_albums_festival_id").on(table.festivalId),
    index("idx_albums_year").on(table.year),
    index("idx_albums_status").on(table.status),
    index("idx_albums_views_count").on(table.viewsCount),
    index("idx_albums_likes_count").on(table.likesCount),
    index("idx_albums_festival_year").on(table.festivalId, table.year),
  ],
);

export const images = pgTable(
  "images",
  {
    id: text("id").primaryKey(),
    albumId: text("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    url: text("url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    size: integer("size").default(0).notNull(),
    mimeType: text("mime_type").default("image/jpeg").notNull(),
    photographer: text("photographer"),
    dateTaken: text("date_taken"),
    copyright: text("copyright"),
    tags: text("tags"), // Stored as comma-separated or JSON string
    status: text("status").default("published").notNull(), // 'draft' | 'pending_review' | 'approved' | 'published' | 'trashed'
    viewsCount: integer("views_count").default(0).notNull(),
    likesCount: integer("likes_count").default(0).notNull(),
    downloadsCount: integer("downloads_count").default(0).notNull(),
    sharesCount: integer("shares_count").default(0).notNull(),
    uploadedBy: text("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_images_album_id").on(table.albumId),
    index("idx_images_status").on(table.status),
    index("idx_images_created_at").on(table.createdAt),
    index("idx_images_deleted_at").on(table.deletedAt),
    index("idx_images_views_count").on(table.viewsCount),
    index("idx_images_likes_count").on(table.likesCount),
    index("idx_images_uploaded_by").on(table.uploadedBy),
    index("idx_images_album_status").on(table.albumId, table.status),
  ],
);

// --- AUTHENTICATION & USERS ---

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").unique().notNull(),
    name: text("name").notNull(),
    role: text("role").notNull(), // 'super_admin' | 'admin' | 'editor' | 'reviewer' | 'viewer'
    permissions: text("permissions").notNull(), // JSON string array of permissions
    status: text("status").default("active").notNull(), // 'active' | 'disabled'
    passwordHash: text("password_hash").notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_users_email").on(table.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    ip: text("ip"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_sessions_user_id").on(table.userId),
    index("idx_sessions_expires_at").on(table.expiresAt),
  ],
);

// --- ENGAGEMENT TABLES ---

export const likes = pgTable(
  "likes",
  {
    id: serial("id").primaryKey(),
    resourceType: text("resource_type").notNull(), // 'image' | 'album'
    resourceId: text("resource_id").notNull(),
    visitorId: text("visitor_id").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uniq_likes_resource_visitor").on(
      table.resourceType,
      table.resourceId,
      table.visitorId,
    ),
    index("idx_likes_resource").on(table.resourceType, table.resourceId),
    index("idx_likes_visitor").on(table.visitorId),
    index("idx_likes_user").on(table.userId),
    index("idx_likes_created_at").on(table.createdAt),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    id: serial("id").primaryKey(),
    resourceType: text("resource_type").default("image").notNull(), // 'image' | 'album'
    resourceId: text("resource_id"),
    imageId: text("image_id").references(() => images.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uniq_favorites_resource_visitor").on(
      table.resourceType,
      table.resourceId,
      table.visitorId,
    ),
    index("idx_favorites_resource").on(table.resourceType, table.resourceId),
    index("idx_favorites_visitor").on(table.visitorId),
    index("idx_favorites_user").on(table.userId),
    index("idx_favorites_created_at").on(table.createdAt),
  ],
);

// --- VISITOR & ANALYTICS FOUNDATION ---

export const visitorSessions = pgTable(
  "visitor_sessions",
  {
    id: text("id").primaryKey(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    device: text("device"), // 'desktop' | 'mobile' | 'tablet' | 'other'
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_visitor_sessions_user_id").on(table.userId),
    index("idx_visitor_sessions_last_seen").on(table.lastSeenAt),
    index("idx_visitor_sessions_created_at").on(table.createdAt),
    index("idx_visitor_sessions_ip_hash").on(table.ipHash),
  ],
);

export const viewsLog = pgTable(
  "views_log",
  {
    id: serial("id").primaryKey(),
    resourceType: text("resource_type").notNull(), // 'page' | 'album' | 'image'
    resourceId: text("resource_id").notNull(),
    visitorId: text("visitor_id").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_views_log_resource").on(table.resourceType, table.resourceId),
    index("idx_views_log_visitor").on(table.visitorId),
    index("idx_views_log_created_at").on(table.createdAt),
    index("idx_views_log_resource_created").on(
      table.resourceType,
      table.resourceId,
      table.createdAt,
    ),
  ],
);

export const downloadsLog = pgTable(
  "downloads_log",
  {
    id: serial("id").primaryKey(),
    imageId: text("image_id")
      .notNull()
      .references(() => images.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_downloads_log_image_id").on(table.imageId),
    index("idx_downloads_log_created_at").on(table.createdAt),
  ],
);

export const sharesLog = pgTable(
  "shares_log",
  {
    id: serial("id").primaryKey(),
    resourceType: text("resource_type").notNull(), // 'image' | 'album'
    resourceId: text("resource_id").notNull(),
    platform: text("platform").notNull(), // 'telegram' | 'facebook' | 'copy_link' | 'email' | 'qr'
    visitorId: text("visitor_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_shares_log_resource").on(table.resourceType, table.resourceId),
    index("idx_shares_log_created_at").on(table.createdAt),
  ],
);

export const searchLogs = pgTable(
  "search_logs",
  {
    id: serial("id").primaryKey(),
    query: text("query").notNull(),
    normalizedQuery: text("normalized_query"),
    resultsCount: integer("results_count").default(0).notNull(),
    visitorId: text("visitor_id"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    selectedResultId: text("selected_result_id"),
    selectedResultType: text("selected_result_type"), // 'album' | 'image' | 'festival'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_search_logs_created_at").on(table.createdAt),
    index("idx_search_logs_normalized_query").on(table.normalizedQuery),
    index("idx_search_logs_visitor_id").on(table.visitorId),
    index("idx_search_logs_results_count").on(table.resultsCount),
    index("idx_search_logs_selected_result").on(table.selectedResultId),
  ],
);

// --- MODERATION & REPORTS ---

export const reports = pgTable(
  "reports",
  {
    id: text("id").primaryKey(),
    imageId: text("image_id")
      .notNull()
      .references(() => images.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(), // 'incorrect_info' | 'wrong_image' | 'duplicate' | 'copyright' | 'other'
    details: text("details"),
    status: text("status").default("pending").notNull(), // 'pending' | 'reviewed' | 'resolved' | 'dismissed'
    resolvedBy: text("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolutionNotes: text("resolution_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_reports_status").on(table.status),
    index("idx_reports_created_at").on(table.createdAt),
  ],
);

// --- ADMINISTRATION & ACTIVITY LOGS ---

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(), // 'pending_review' | 'report_submitted' | 'upload_alert' | 'system'
    title: text("title").notNull(),
    message: text("message").notNull(),
    link: text("link"),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_notifications_is_read").on(table.isRead),
    index("idx_notifications_created_at").on(table.createdAt),
  ],
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    userName: text("user_name").notNull(),
    userRole: text("user_role").notNull(),
    action: text("action").notNull(),
    resource: text("resource").notNull(),
    resourceId: text("resource_id"),
    details: text("details"),
    ip: text("ip"),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_activity_logs_user_id").on(table.userId),
    index("idx_activity_logs_timestamp").on(table.timestamp),
    index("idx_activity_logs_action").on(table.action),
  ],
);

// --- RELATIONS ---

export const festivalsRelations = relations(festivals, ({ many }) => ({
  albums: many(albums),
}));

export const yearsRelations = relations(years, ({ many }) => ({
  albums: many(albums),
}));

export const albumsRelations = relations(albums, ({ one, many }) => ({
  festival: one(festivals, {
    fields: [albums.festivalId],
    references: [festivals.id],
  }),
  yearRecord: one(years, {
    fields: [albums.year],
    references: [years.year],
  }),
  images: many(images),
}));

export const imagesRelations = relations(images, ({ one, many }) => ({
  album: one(albums, {
    fields: [images.albumId],
    references: [albums.id],
  }),
  uploader: one(users, {
    fields: [images.uploadedBy],
    references: [users.id],
  }),
  favorites: many(favorites),
  reports: many(reports),
}));

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  uploadedImages: many(images),
  favorites: many(favorites),
  likes: many(likes),
  resolvedReports: many(reports),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
