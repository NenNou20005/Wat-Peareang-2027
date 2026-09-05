import { getDrizzleDb, isPostgresConfigured } from "../db/index.ts";
import * as schema from "../db/schema.ts";
import { eq, and, desc, asc, sql, ilike, or, gte, lte, inArray, ne } from "drizzle-orm";
import { normalizeSearchQuery } from "../lib/search-normalizer.ts";
import type { Festival, Album } from "../data/archive";

export interface DbFestival extends Festival {
  description?: string | null | undefined;
  status?: string | undefined;
  isCustom?: boolean | undefined;
}

export interface DbAlbum extends Album {
  description?: string | null | undefined;
  eventId?: string | null | undefined;
  viewsCount?: number | undefined;
  likesCount?: number | undefined;
  status?: string | undefined;
  sortOrder?: number | undefined;
  coverImage?: string | null | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export interface DbPhoto {
  id: string;
  albumId?: string | undefined;
  src: string;
  caption: string;
  tall: boolean;
  thumbnailUrl?: string | null | undefined;
  size?: number | undefined;
  mimeType?: string | undefined;
  photographer?: string | null | undefined;
  dateTaken?: string | null | undefined;
  copyright?: string | null | undefined;
  tags?: string | null | undefined;
  viewsCount?: number | undefined;
  likesCount?: number | undefined;
  downloadsCount?: number | undefined;
  sharesCount?: number | undefined;
  createdAt?: string | undefined;
}

export interface DbVideo {
  id: string;
  albumId?: string | undefined;
  albumTitle?: string | undefined;
  festivalName?: string | undefined;
  year?: number | undefined;
  title: string;
  filename?: string | null | undefined;
  url: string;
  thumbnailUrl?: string | null | undefined;
  duration?: number | null | undefined;
  width?: number | null | undefined;
  height?: number | null | undefined;
  size?: number | null | undefined;
  mimeType?: string | null | undefined;
  viewsCount?: number | undefined;
  likesCount?: number | undefined;
  status?: string | undefined;
  createdAt?: string | undefined;
}

export interface ArchiveStats {
  totalFestivals: number;
  totalYears: number;
  totalAlbums: number;
  totalImages: number;
  totalVideos?: number;
  yearStatsMap: Record<number, { albums: number; photos: number; locations: number }>;
}

/**
 * 1. Read all published festivals from PostgreSQL
 */
export async function getPostgresFestivals(): Promise<DbFestival[]> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return [];
  }

  try {
    const rows = await db
      .select()
      .from(schema.festivals)
      .where(or(eq(schema.festivals.status, "published"), eq(schema.festivals.status, "approved")))
      .orderBy(asc(schema.festivals.createdAt));

    if (!rows || rows.length === 0) {
      return [];
    }

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      emoji: r.emoji,
      accent: r.accent,
      month: r.month,
      cover: r.coverUrl || `/assets/fest-${r.id}.jpg`,
      description: r.description,
      status: r.status,
      isCustom: r.isCustom,
    }));
  } catch (err) {
    console.warn("[PostgreSQL Query Error] Failed to read festivals from Postgres:", err);
    return [];
  }
}

/**
 * 2. Read all recorded years from PostgreSQL
 */
export async function getPostgresYears(): Promise<number[]> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return [];
  }

  try {
    const rows = await db
      .select({ year: schema.years.year })
      .from(schema.years)
      .orderBy(desc(schema.years.year));

    if (!rows || rows.length === 0) {
      return [];
    }

    return rows.map((r) => r.year);
  } catch (err) {
    console.warn("[PostgreSQL Query Error] Failed to read years from Postgres:", err);
    return [];
  }
}

/**
 * 3. Read albums from PostgreSQL with dynamic joined festival information and optional filters
 */
export async function getPostgresAlbums(filter?: {
  year?: number | undefined;
  festivalId?: string | undefined;
  search?: string | undefined;
}): Promise<DbAlbum[]> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return [];
  }

  try {
    const conditions = [
      or(eq(schema.albums.status, "published"), eq(schema.albums.status, "approved")),
    ];

    if (filter?.year) {
      conditions.push(eq(schema.albums.year, filter.year));
    }
    if (filter?.festivalId) {
      conditions.push(eq(schema.albums.festivalId, filter.festivalId));
    }

    const rows = await db
      .select({
        album: schema.albums,
        festival: schema.festivals,
        actualPhotoCount: sql<number>`(
          SELECT count(*)::int FROM ${schema.images}
          WHERE ${schema.images.albumId} = ${schema.albums.id}
          AND ${schema.images.status} != 'trashed'
          AND ${schema.images.deletedAt} IS NULL
        )`,
        actualVideoCount: sql<number>`(
          SELECT count(*)::int FROM ${schema.videos}
          WHERE ${schema.videos.albumId} = ${schema.albums.id}
          AND ${schema.videos.status} != 'trashed'
          AND ${schema.videos.deletedAt} IS NULL
        )`,
        firstImageUrl: sql<string | null>`(
          SELECT COALESCE(${schema.images.thumbnailUrl}, ${schema.images.url}) FROM ${schema.images}
          WHERE ${schema.images.albumId} = ${schema.albums.id}
          AND ${schema.images.status} != 'trashed'
          AND ${schema.images.deletedAt} IS NULL
          ORDER BY ${schema.images.createdAt} ASC
          LIMIT 1
        )`,
      })
      .from(schema.albums)
      .innerJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
      .where(and(...conditions))
      .orderBy(desc(schema.albums.year), asc(schema.festivals.createdAt));

    if (!rows || rows.length === 0) {
      return [];
    }

    let mapped: DbAlbum[] = rows.map(({ album, festival, actualPhotoCount, actualVideoCount, firstImageUrl }) => {
      const festObj: Festival = {
        id: festival.id,
        name: festival.name,
        emoji: festival.emoji,
        accent: festival.accent,
        month: festival.month,
        cover: festival.coverUrl || `/assets/fest-${festival.id}.jpg`,
      };

      const realCount =
        actualPhotoCount !== undefined && actualPhotoCount !== null
          ? Number(actualPhotoCount)
          : album.photoCount || 0;

      const realVideoCount =
        actualVideoCount !== undefined && actualVideoCount !== null
          ? Number(actualVideoCount)
          : 0;

      return {
        id: album.id,
        festivalId: album.festivalId,
        festival: festObj,
        year: album.year,
        location: album.location,
        photoCount: realCount,
        videoCount: realVideoCount,
        title: album.title,
        description: album.description,
        coverImage: album.coverImage || firstImageUrl || festObj.cover,
        viewsCount: album.viewsCount,
        likesCount: album.likesCount,
        status: album.status,
      };
    });

    if (filter?.search) {
      const rawQ = filter.search.toLowerCase().trim();
      const normQ = normalizeSearchQuery(filter.search);
      mapped = mapped.filter((a) => {
        const titleLower = a.title.toLowerCase();
        const festNameLower = a.festival.name.toLowerCase();
        const locLower = (a.location || "").toLowerCase();
        const descLower = (a.description || "").toLowerCase();
        const yearStr = String(a.year);

        return (
          titleLower.includes(rawQ) ||
          festNameLower.includes(rawQ) ||
          locLower.includes(rawQ) ||
          descLower.includes(rawQ) ||
          yearStr.includes(rawQ) ||
          yearStr.includes(normQ) ||
          normalizeSearchQuery(a.title).includes(normQ) ||
          normalizeSearchQuery(a.festival.name).includes(normQ) ||
          normalizeSearchQuery(a.location || "").includes(normQ)
        );
      });
    }

    return mapped;
  } catch (err) {
    console.warn("[PostgreSQL Query Error] Failed to read albums from Postgres:", err);
    return [];
  }
}

/**
 * 4. Read single album by ID with joined festival info
 */
export async function getPostgresAlbumById(albumId: string): Promise<DbAlbum | null> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return null;
  }

  try {
    const rows = await db
      .select({
        album: schema.albums,
        festival: schema.festivals,
        actualPhotoCount: sql<number>`(
          SELECT count(*)::int FROM ${schema.images}
          WHERE ${schema.images.albumId} = ${schema.albums.id}
          AND ${schema.images.status} != 'trashed'
          AND ${schema.images.deletedAt} IS NULL
        )`,
        actualVideoCount: sql<number>`(
          SELECT count(*)::int FROM ${schema.videos}
          WHERE ${schema.videos.albumId} = ${schema.albums.id}
          AND ${schema.videos.status} != 'trashed'
          AND ${schema.videos.deletedAt} IS NULL
        )`,
        firstImageUrl: sql<string | null>`(
          SELECT COALESCE(${schema.images.thumbnailUrl}, ${schema.images.url}) FROM ${schema.images}
          WHERE ${schema.images.albumId} = ${schema.albums.id}
          AND ${schema.images.status} != 'trashed'
          AND ${schema.images.deletedAt} IS NULL
          ORDER BY ${schema.images.createdAt} ASC
          LIMIT 1
        )`,
      })
      .from(schema.albums)
      .innerJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
      .where(eq(schema.albums.id, albumId))
      .limit(1);

    if (!rows || rows.length === 0) {
      return null;
    }

    const { album, festival, actualPhotoCount, actualVideoCount, firstImageUrl } = rows[0]!;
    const festObj: Festival = {
      id: festival.id,
      name: festival.name,
      emoji: festival.emoji,
      accent: festival.accent,
      month: festival.month,
      cover: festival.coverUrl || `/assets/fest-${festival.id}.jpg`,
    };

    const realCount =
      actualPhotoCount !== undefined && actualPhotoCount !== null
        ? Number(actualPhotoCount)
        : album.photoCount || 0;

    const realVideoCount =
      actualVideoCount !== undefined && actualVideoCount !== null
        ? Number(actualVideoCount)
        : 0;

    return {
      id: album.id,
      festivalId: album.festivalId,
      festival: festObj,
      year: album.year,
      location: album.location,
      photoCount: realCount,
      videoCount: realVideoCount,
      title: album.title,
      description: album.description,
      coverImage: album.coverImage || firstImageUrl || festObj.cover,
      viewsCount: album.viewsCount,
      likesCount: album.likesCount,
      status: album.status,
    };
  } catch (err) {
    console.warn("[PostgreSQL Query Error] Failed to read album by ID:", err);
    return null;
  }
}

/**
 * 5. Read all photos for a specific album from PostgreSQL
 */
export async function getPostgresPhotosForAlbum(albumId: string): Promise<DbPhoto[]> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return [];
  }

  try {
    const rows = await db
      .select()
      .from(schema.images)
      .where(
        and(
          eq(schema.images.albumId, albumId),
          or(eq(schema.images.status, "published"), eq(schema.images.status, "approved")),
          sql`${schema.images.deletedAt} IS NULL`,
        ),
      )
      .orderBy(asc(schema.images.createdAt), asc(schema.images.id));

    if (rows && rows.length > 0) {
      return rows.map((img, idx) => ({
        id: img.id,
        albumId: img.albumId,
        src: img.url,
        caption: img.title || `រូបភាពទី ${idx + 1}`,
        tall: idx % 5 === 0,
        thumbnailUrl: img.thumbnailUrl || img.url,
        size: img.size,
        mimeType: img.mimeType,
        photographer: img.photographer,
        dateTaken: img.dateTaken ? new Date(img.dateTaken).toISOString() : undefined,
        copyright: img.copyright,
        tags: img.tags,
        viewsCount: img.viewsCount,
        likesCount: img.likesCount,
        downloadsCount: img.downloadsCount,
        sharesCount: img.sharesCount,
        createdAt: img.createdAt ? img.createdAt.toISOString() : undefined,
      }));
    }

    return [];
  } catch (err) {
    console.warn("[PostgreSQL Query Error] Failed to read album photos from Postgres:", err);
    return [];
  }
}

/**
 * 5.1 Read all published videos for a specific album from PostgreSQL
 */
export async function getPostgresVideosForAlbum(albumId: string): Promise<DbVideo[]> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return [];
  }

  try {
    const rows = await db
      .select({
        video: schema.videos,
        album: schema.albums,
        festival: schema.festivals,
      })
      .from(schema.videos)
      .innerJoin(schema.albums, eq(schema.videos.albumId, schema.albums.id))
      .innerJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
      .where(
        and(
          eq(schema.videos.albumId, albumId),
          or(eq(schema.videos.status, "published"), eq(schema.videos.status, "approved")),
          sql`${schema.videos.deletedAt} IS NULL`,
        ),
      )
      .orderBy(asc(schema.videos.createdAt), asc(schema.videos.id));

    if (rows && rows.length > 0) {
      return rows.map(({ video, album, festival }) => ({
        id: video.id,
        albumId: video.albumId,
        albumTitle: album.title,
        festivalName: festival.name,
        year: album.year,
        title: video.title,
        filename: video.filename,
        url: video.url,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
        width: video.width,
        height: video.height,
        size: video.size,
        mimeType: video.mimeType,
        viewsCount: video.viewsCount,
        likesCount: video.likesCount,
        status: video.status,
        createdAt: video.createdAt ? video.createdAt.toISOString() : undefined,
      }));
    }

    return [];
  } catch (err) {
    console.warn("[PostgreSQL Query Error] Failed to read album videos from Postgres:", err);
    return [];
  }
}

/**
 * 6. Aggregate archive statistics from PostgreSQL
 */
export async function getPostgresArchiveStats(targetYear?: number): Promise<ArchiveStats> {
  const db = getDrizzleDb();
  const defaultEmptyStats: ArchiveStats = {
    totalFestivals: 0,
    totalYears: 0,
    totalAlbums: 0,
    totalImages: 0,
    yearStatsMap: {},
  };

  if (!db || !isPostgresConfigured()) {
    return defaultEmptyStats;
  }

  try {
    const [festivalsCountRes, yearsCountRes, albumsCountRes, imagesCountRes, yearGroupRes] =
      await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.festivals)
          .where(sql`${schema.festivals.status} != 'trashed'`),
        db.select({ count: sql<number>`count(*)` }).from(schema.years),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.albums)
          .where(sql`${schema.albums.status} != 'trashed'`),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.images)
          .where(
            and(sql`${schema.images.status} != 'trashed'`, sql`${schema.images.deletedAt} IS NULL`),
          ),
        db
          .select({
            year: schema.albums.year,
            albumCount: sql<number>`count(distinct ${schema.albums.id})`,
            photoSum: sql<number>`count(${schema.images.id})`,
            locationCount: sql<number>`count(distinct ${schema.albums.location})`,
          })
          .from(schema.albums)
          .leftJoin(
            schema.images,
            and(
              eq(schema.images.albumId, schema.albums.id),
              sql`${schema.images.status} != 'trashed'`,
              sql`${schema.images.deletedAt} IS NULL`,
            ),
          )
          .where(sql`${schema.albums.status} != 'trashed'`)
          .groupBy(schema.albums.year),
      ]);

    const dynamicYearStatsMap: Record<
      number,
      { albums: number; photos: number; locations: number }
    > = {};

    if (yearGroupRes && yearGroupRes.length > 0) {
      for (const row of yearGroupRes) {
        dynamicYearStatsMap[row.year] = {
          albums: Number(row.albumCount || 0),
          photos: Number(row.photoSum || 0),
          locations: Number(row.locationCount || 1),
        };
      }
    }

    return {
      totalFestivals: Number(festivalsCountRes[0]?.count || 0),
      totalYears: Number(yearsCountRes[0]?.count || 0),
      totalAlbums: Number(albumsCountRes[0]?.count || 0),
      totalImages: Number(imagesCountRes[0]?.count || 0),
      yearStatsMap: dynamicYearStatsMap,
    };
  } catch (err) {
    console.warn("[PostgreSQL Query Error] Failed to compute archive stats from Postgres:", err);
    return defaultEmptyStats;
  }
}

/**
 * 7. Search albums and festivals in PostgreSQL
 */
export async function searchPostgresArchive(query: string): Promise<DbAlbum[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return getPostgresAlbums({ search: q });
}

/**
 * 7.1 Search public videos in PostgreSQL
 */
export async function searchPostgresVideos(query: string): Promise<DbVideo[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) return [];

  try {
    const rawPattern = `%${q}%`;
    const normQ = normalizeSearchQuery(q);
    const normPattern = `%${normQ}%`;

    const rows = await db
      .select({
        video: schema.videos,
        album: schema.albums,
        festival: schema.festivals,
      })
      .from(schema.videos)
      .innerJoin(schema.albums, eq(schema.videos.albumId, schema.albums.id))
      .innerJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
      .where(
        and(
          or(eq(schema.videos.status, "published"), eq(schema.videos.status, "approved")),
          sql`${schema.videos.deletedAt} IS NULL`,
          or(
            ilike(schema.videos.title, rawPattern),
            ilike(schema.videos.filename, rawPattern),
            ilike(schema.albums.title, rawPattern),
            ilike(schema.festivals.name, rawPattern),
            sql`CAST(${schema.albums.year} AS TEXT) ILIKE ${rawPattern}`,
            ilike(schema.videos.title, normPattern),
            ilike(schema.albums.title, normPattern),
            ilike(schema.festivals.name, normPattern),
          ),
        ),
      )
      .orderBy(desc(schema.videos.createdAt))
      .limit(50);

    return rows.map(({ video, album, festival }) => ({
      id: video.id,
      albumId: video.albumId,
      albumTitle: album.title,
      festivalName: festival.name,
      year: album.year,
      title: video.title,
      filename: video.filename,
      url: video.url,
      thumbnailUrl: video.thumbnailUrl,
      duration: video.duration,
      width: video.width,
      height: video.height,
      size: video.size,
      mimeType: video.mimeType,
      viewsCount: video.viewsCount,
      likesCount: video.likesCount,
      status: video.status,
      createdAt: video.createdAt ? video.createdAt.toISOString() : undefined,
    }));
  } catch (err) {
    console.warn("[PostgreSQL Query Error] Failed to search videos from Postgres:", err);
    return [];
  }
}

// --- PHASE 2.2 ADMIN QUERIES & ANALYTICS ---

export interface AdminDashboardMetrics {
  totalFestivals: number;
  totalYears: number;
  totalAlbums: number;
  totalImages: number;
  totalUsers: number;
  totalViews: number;
  totalLikes: number;
  totalFavorites: number;
  totalTrash: number;
  isPostgresConnected: boolean;
  recentActivities: Array<{
    id: string;
    userName: string;
    userRole: string;
    action: string;
    resource: string;
    details?: string | null | undefined;
    timestamp: string;
  }>;
  recentImages: Array<{
    id: string;
    albumId: string;
    title: string;
    url: string;
    thumbnailUrl?: string | null | undefined;
    createdAt?: string | undefined;
    uploadedBy?: string | null | undefined;
  }>;
}

export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const db = getDrizzleDb();
  const isConnected = isPostgresConfigured() && !!db;

  if (!db || !isConnected) {
    const fallbackStats = await getPostgresArchiveStats();
    return {
      totalFestivals: fallbackStats.totalFestivals,
      totalYears: fallbackStats.totalYears,
      totalAlbums: fallbackStats.totalAlbums,
      totalImages: fallbackStats.totalImages,
      totalUsers: 1,
      totalViews: 1240,
      totalLikes: 420,
      totalFavorites: 85,
      totalTrash: 0,
      isPostgresConnected: false,
      recentActivities: [],
      recentImages: [],
    };
  }

  try {
    const [
      festivalsRes,
      yearsRes,
      albumsRes,
      imagesRes,
      usersRes,
      likesRes,
      favsRes,
      viewsRes,
      trashedImagesRes,
      trashedAlbumsRes,
      recentLogsRes,
      recentImagesRes,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.festivals)
        .where(sql`${schema.festivals.status} != 'trashed'`),
      db.select({ count: sql<number>`count(*)` }).from(schema.years),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.albums)
        .where(sql`${schema.albums.status} != 'trashed'`),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.images)
        .where(
          and(sql`${schema.images.status} != 'trashed'`, sql`${schema.images.deletedAt} IS NULL`),
        ),
      db.select({ count: sql<number>`count(*)` }).from(schema.users),
      db.select({ count: sql<number>`count(*)` }).from(schema.likes),
      db.select({ count: sql<number>`count(*)` }).from(schema.favorites),
      db.select({ count: sql<number>`count(*)` }).from(schema.viewsLog),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.images)
        .where(
          or(eq(schema.images.status, "trashed"), sql`${schema.images.deletedAt} IS NOT NULL`),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.albums)
        .where(eq(schema.albums.status, "trashed")),
      db.select().from(schema.activityLogs).orderBy(desc(schema.activityLogs.timestamp)).limit(10),
      db
        .select()
        .from(schema.images)
        .where(
          and(sql`${schema.images.status} != 'trashed'`, sql`${schema.images.deletedAt} IS NULL`),
        )
        .orderBy(desc(schema.images.createdAt))
        .limit(8),
    ]);

    const totalTrash =
      Number(trashedImagesRes[0]?.count || 0) + Number(trashedAlbumsRes[0]?.count || 0);

    return {
      totalFestivals: Number(festivalsRes[0]?.count || 0),
      totalYears: Number(yearsRes[0]?.count || 0),
      totalAlbums: Number(albumsRes[0]?.count || 0),
      totalImages: Number(imagesRes[0]?.count || 0),
      totalUsers: Number(usersRes[0]?.count || 1),
      totalViews: Number(viewsRes[0]?.count || 0),
      totalLikes: Number(likesRes[0]?.count || 0),
      totalFavorites: Number(favsRes[0]?.count || 0),
      totalTrash,
      isPostgresConnected: true,
      recentActivities: (recentLogsRes || []).map((l) => ({
        id: l.id,
        userName: l.userName,
        userRole: l.userRole,
        action: l.action,
        resource: l.resource,
        details: l.details || undefined,
        timestamp: l.timestamp.toISOString(),
      })),
      recentImages: (recentImagesRes || []).map((img) => ({
        id: img.id,
        albumId: img.albumId,
        title: img.title,
        url: img.url,
        thumbnailUrl: img.thumbnailUrl,
        createdAt: img.createdAt.toISOString(),
        uploadedBy: img.uploadedBy,
      })),
    };
  } catch (err) {
    console.warn("[getAdminDashboardMetrics Error]:", err);
    return {
      totalFestivals: 0,
      totalYears: 0,
      totalAlbums: 0,
      totalImages: 0,
      totalUsers: 1,
      totalViews: 0,
      totalLikes: 0,
      totalFavorites: 0,
      totalTrash: 0,
      isPostgresConnected: false,
      recentActivities: [],
      recentImages: [],
    };
  }
}

export interface AdminPaginatedAlbumsResult {
  albums: DbAlbum[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getAdminAlbumsPaginated(params: {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  festivalId?: string | undefined;
  year?: number | undefined;
  status?: string | undefined;
}): Promise<AdminPaginatedAlbumsResult> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(100, params.limit || 20));
  const offset = (page - 1) * limit;

  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return {
      albums: [],
      total: 0,
      page,
      limit,
      totalPages: 1,
    };
  }

  try {
    const conditions = [];
    if (params.status === "trashed") {
      conditions.push(eq(schema.albums.status, "trashed"));
    } else {
      conditions.push(sql`${schema.albums.status} != 'trashed'`);
    }

    if (params.year) conditions.push(eq(schema.albums.year, params.year));
    if (params.festivalId) conditions.push(eq(schema.albums.festivalId, params.festivalId));
    if (params.search && params.search.trim().length > 0) {
      const q = `%${params.search.trim()}%`;
      conditions.push(or(ilike(schema.albums.title, q), ilike(schema.festivals.name, q)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.albums)
      .innerJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
      .where(whereClause);

    const total = Number(countRes[0]?.count || 0);

    const rows = await db
      .select({
        album: schema.albums,
        festival: schema.festivals,
        actualPhotoCount: sql<number>`(
          SELECT count(*)::int FROM ${schema.images}
          WHERE ${schema.images.albumId} = ${schema.albums.id}
          AND ${schema.images.status} != 'trashed'
          AND ${schema.images.deletedAt} IS NULL
        )`,
        firstImageUrl: sql<string | null>`(
          SELECT COALESCE(${schema.images.thumbnailUrl}, ${schema.images.url}) FROM ${schema.images}
          WHERE ${schema.images.albumId} = ${schema.albums.id}
          AND ${schema.images.status} != 'trashed'
          AND ${schema.images.deletedAt} IS NULL
          ORDER BY ${schema.images.createdAt} ASC
          LIMIT 1
        )`,
      })
      .from(schema.albums)
      .innerJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
      .where(whereClause)
      .orderBy(desc(schema.albums.year), asc(schema.albums.title))
      .limit(limit)
      .offset(offset);

    const mapped: DbAlbum[] = rows.map(({ album, festival, actualPhotoCount, firstImageUrl }) => {
      const realCount =
        actualPhotoCount !== undefined && actualPhotoCount !== null
          ? Number(actualPhotoCount)
          : album.photoCount || 0;

      return {
        id: album.id,
        festivalId: album.festivalId,
        festival: {
          id: festival.id,
          name: festival.name,
          emoji: festival.emoji,
          accent: festival.accent,
          month: festival.month,
          cover: festival.coverUrl || `/assets/fest-${festival.id}.jpg`,
        },
        year: album.year,
        location: album.location,
        photoCount: realCount,
        title: album.title,
        description: album.description,
        coverImage: album.coverImage || firstImageUrl || festival.coverUrl || `/assets/fest-${festival.id}.jpg`,
        viewsCount: album.viewsCount,
        likesCount: album.likesCount,
        status: album.status,
      };
    });

    return {
      albums: mapped,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  } catch (err) {
    console.warn("[getAdminAlbumsPaginated Error]:", err);
    return {
      albums: [],
      total: 0,
      page,
      limit,
      totalPages: 1,
    };
  }
}

export interface AdminPaginatedImagesResult {
  images: Array<{
    id: string;
    albumId: string;
    albumTitle?: string | null | undefined;
    festivalName?: string | null | undefined;
    year?: number | null | undefined;
    title: string;
    description?: string | null | undefined;
    url: string;
    thumbnailUrl?: string | null | undefined;
    size: number;
    mimeType: string;
    photographer?: string | null | undefined;
    dateTaken?: string | null | undefined;
    copyright?: string | null | undefined;
    tags?: string | null | undefined;
    viewsCount: number;
    likesCount: number;
    downloadsCount: number;
    sharesCount: number;
    status: string;
    uploadedBy?: string | null | undefined;
    createdAt: string;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getAdminImagesPaginated(params: {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  albumId?: string | undefined;
  festivalId?: string | undefined;
  year?: number | undefined;
  status?: string | undefined;
}): Promise<AdminPaginatedImagesResult> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(100, params.limit || 24));
  const offset = (page - 1) * limit;

  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return {
      images: [],
      total: 0,
      page,
      limit,
      totalPages: 1,
    };
  }

  try {
    const conditions = [];

    if (params.status === "trashed") {
      conditions.push(
        or(eq(schema.images.status, "trashed"), sql`${schema.images.deletedAt} IS NOT NULL`),
      );
    } else {
      conditions.push(
        and(sql`${schema.images.status} != 'trashed'`, sql`${schema.images.deletedAt} IS NULL`),
      );
    }

    if (params.albumId) {
      conditions.push(eq(schema.images.albumId, params.albumId));
    }
    if (params.year) {
      conditions.push(eq(schema.albums.year, params.year));
    }
    if (params.festivalId) {
      conditions.push(eq(schema.albums.festivalId, params.festivalId));
    }
    if (params.search && params.search.trim().length > 0) {
      const q = `%${params.search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.images.title, q),
          ilike(schema.images.description, q),
          ilike(schema.images.photographer, q),
          ilike(schema.images.tags, q),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.images)
      .leftJoin(schema.albums, eq(schema.images.albumId, schema.albums.id))
      .leftJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
      .where(whereClause);

    const total = Number(countRes[0]?.count || 0);

    const rows = await db
      .select({
        img: schema.images,
        albumTitle: schema.albums.title,
        year: schema.albums.year,
        festivalName: schema.festivals.name,
      })
      .from(schema.images)
      .leftJoin(schema.albums, eq(schema.images.albumId, schema.albums.id))
      .leftJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
      .where(whereClause)
      .orderBy(desc(schema.images.createdAt))
      .limit(limit)
      .offset(offset);

    const mapped = rows.map((r) => ({
      id: r.img.id,
      albumId: r.img.albumId,
      albumTitle: r.albumTitle || undefined,
      festivalName: r.festivalName || undefined,
      year: r.year || undefined,
      title: r.img.title,
      description: r.img.description,
      url: r.img.url,
      thumbnailUrl: r.img.thumbnailUrl,
      size: r.img.size,
      mimeType: r.img.mimeType,
      photographer: r.img.photographer,
      dateTaken: r.img.dateTaken,
      copyright: r.img.copyright,
      tags: r.img.tags,
      viewsCount: r.img.viewsCount,
      likesCount: r.img.likesCount,
      downloadsCount: r.img.downloadsCount,
      sharesCount: r.img.sharesCount,
      status: r.img.status,
      uploadedBy: r.img.uploadedBy,
      createdAt: r.img.createdAt.toISOString(),
    }));

    return {
      images: mapped,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  } catch (err) {
    console.warn("[getAdminImagesPaginated Error]:", err);
    return {
      images: [],
      total: 0,
      page,
      limit,
      totalPages: 1,
    };
  }
}

export async function getDiverseArchiveImages(limit = 24) {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) return [];

  try {
    const res = await db.execute(sql`
      WITH ranked_photos AS (
        SELECT 
          i.id,
          i.album_id,
          a.title as album_title,
          a.year,
          f.name as festival_name,
          i.title,
          i.description,
          i.url,
          i.thumbnail_url,
          i.photographer,
          i.date_taken,
          i.copyright,
          i.tags,
          i.views_count,
          i.likes_count,
          i.downloads_count,
          i.shares_count,
          i.status,
          i.uploaded_by,
          i.created_at,
          ROW_NUMBER() OVER(PARTITION BY i.album_id ORDER BY i.created_at DESC) as rn
        FROM images i
        JOIN albums a ON i.album_id = a.id
        JOIN festivals f ON a.festival_id = f.id
        WHERE i.status != 'trashed' AND i.deleted_at IS NULL
      )
      SELECT *
      FROM ranked_photos
      WHERE rn = 1
      ORDER BY created_at DESC;
    `);

    const rows = (res.rows || []) as any[];
    if (rows.length === 0) return [];

    // Group by festival
    const byFestival: Record<string, any[]> = {};
    for (const row of rows) {
      const fest = row.festival_name || "ផ្សេងៗ";
      if (!byFestival[fest]) byFestival[fest] = [];
      byFestival[fest].push(row);
    }

    // Interleave round-robin across festivals
    const interleaved: any[] = [];
    const festKeys = Object.keys(byFestival);
    let idx = 0;
    while (interleaved.length < limit) {
      let added = false;
      for (const key of festKeys) {
        if (byFestival[key] && byFestival[key][idx]) {
          interleaved.push(byFestival[key][idx]);
          added = true;
          if (interleaved.length >= limit) break;
        }
      }
      if (!added) break;
      idx++;
    }

    return interleaved.slice(0, limit).map((r) => ({
      id: r.id,
      albumId: r.album_id,
      albumTitle: r.album_title || undefined,
      festivalName: r.festival_name || undefined,
      year: r.year || undefined,
      title: r.title,
      description: r.description,
      url: r.url,
      thumbnailUrl: r.thumbnail_url,
      photographer: r.photographer,
      dateTaken: r.date_taken ? new Date(r.date_taken).toISOString() : null,
      copyright: r.copyright,
      tags: r.tags,
      viewsCount: r.views_count || 0,
      likesCount: r.likes_count || 0,
      downloadsCount: r.downloads_count || 0,
      sharesCount: r.shares_count || 0,
      status: r.status || "published",
      uploadedBy: r.uploaded_by,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));
  } catch (err) {
    console.warn("[getDiverseArchiveImages Error]:", err);
    return [];
  }
}

export async function getAllArchiveImagesForSlideshow() {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) return [];

  try {
    const res = await db.execute(sql`
      SELECT 
        i.id,
        i.album_id,
        a.title as album_title,
        a.year,
        f.name as festival_name,
        i.title,
        i.description,
        i.url,
        i.thumbnail_url,
        i.photographer,
        i.date_taken,
        i.copyright,
        i.tags,
        i.views_count,
        i.likes_count,
        i.downloads_count,
        i.shares_count,
        i.status,
        i.uploaded_by,
        i.created_at
      FROM images i
      JOIN albums a ON i.album_id = a.id
      JOIN festivals f ON a.festival_id = f.id
      WHERE i.status != 'trashed' AND i.deleted_at IS NULL
      ORDER BY i.created_at DESC;
    `);

    const rows = (res.rows || []) as any[];
    return rows.map((r) => ({
      id: r.id,
      albumId: r.album_id,
      albumTitle: r.album_title || undefined,
      festivalName: r.festival_name || undefined,
      year: r.year || undefined,
      title: r.title,
      description: r.description,
      url: r.url,
      thumbnailUrl: r.thumbnail_url,
      photographer: r.photographer,
      dateTaken: r.date_taken ? new Date(r.date_taken).toISOString() : null,
      copyright: r.copyright,
      tags: r.tags,
      viewsCount: r.views_count || 0,
      likesCount: r.likes_count || 0,
      downloadsCount: r.downloads_count || 0,
      sharesCount: r.shares_count || 0,
      status: r.status || "published",
      uploadedBy: r.uploaded_by,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));
  } catch (err) {
    console.warn("[getAllArchiveImagesForSlideshow Error]:", err);
    return [];
  }
}

export interface SlideshowAlbumData {
  id: string;
  title: string;
  year: number;
  festivalId: string;
  festivalName: string;
  festivalEmoji: string;
  coverImage?: string;
  location?: string;
  images: Array<{
    id: string;
    albumId: string;
    albumTitle?: string;
    festivalName?: string;
    year?: number;
    title: string;
    description?: string | null;
    url: string;
    thumbnailUrl?: string | null;
    photographer?: string | null;
    dateTaken?: string | null;
    copyright?: string | null;
    tags?: string | null;
    viewsCount?: number;
    likesCount?: number;
    downloadsCount?: number;
    sharesCount?: number;
    status: string;
    uploadedBy?: string | null;
    createdAt?: string;
  }>;
}

export async function getArchiveAlbumsWithAllImages(): Promise<SlideshowAlbumData[]> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) return [];

  try {
    const res = await db.execute(sql`
      SELECT 
        i.id,
        i.album_id,
        a.title as album_title,
        a.year,
        a.festival_id,
        a.cover_image as album_cover,
        a.location as album_location,
        f.name as festival_name,
        f.emoji as festival_emoji,
        i.title,
        i.description,
        i.url,
        i.thumbnail_url,
        i.photographer,
        i.date_taken,
        i.copyright,
        i.tags,
        i.views_count,
        i.likes_count,
        i.downloads_count,
        i.shares_count,
        i.status,
        i.uploaded_by,
        i.created_at as image_created_at
      FROM images i
      JOIN albums a ON i.album_id = a.id
      JOIN festivals f ON a.festival_id = f.id
      WHERE i.status != 'trashed' AND i.deleted_at IS NULL
      ORDER BY a.year DESC, f.name ASC, a.created_at DESC, i.created_at ASC;
    `);

    const rows = (res.rows || []) as any[];
    if (rows.length === 0) return [];

    const albumMap = new Map<string, SlideshowAlbumData>();

    for (const row of rows) {
      if (!albumMap.has(row.album_id)) {
        albumMap.set(row.album_id, {
          id: row.album_id,
          title: row.album_title,
          year: row.year,
          festivalId: row.festival_id,
          festivalName: row.festival_name,
          festivalEmoji: row.festival_emoji || "🎉",
          coverImage: row.album_cover || undefined,
          location: row.album_location || undefined,
          images: [],
        });
      }

      albumMap.get(row.album_id)!.images.push({
        id: row.id,
        albumId: row.album_id,
        albumTitle: row.album_title,
        festivalName: row.festival_name,
        year: row.year,
        title: row.title,
        description: row.description,
        url: row.url,
        thumbnailUrl: row.thumbnail_url,
        photographer: row.photographer,
        dateTaken: row.date_taken ? new Date(row.date_taken).toISOString() : null,
        copyright: row.copyright,
        tags: row.tags,
        viewsCount: row.views_count || 0,
        likesCount: row.likes_count || 0,
        downloadsCount: row.downloads_count || 0,
        sharesCount: row.shares_count || 0,
        status: row.status || "published",
        uploadedBy: row.uploaded_by,
        createdAt: row.image_created_at ? new Date(row.image_created_at).toISOString() : new Date().toISOString(),
      });
    }

    return Array.from(albumMap.values());
  } catch (err) {
    console.warn("[getArchiveAlbumsWithAllImages Error]:", err);
    return [];
  }
}

export async function getAdminTrashItems() {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return {
      festivals: [],
      years: [],
      albums: [],
      images: [],
      total: 0,
    };
  }

  try {
    const [trashedFestivals, trashedAlbums, trashedImages, trashedVideos] = await Promise.all([
      db
        .select()
        .from(schema.festivals)
        .where(eq(schema.festivals.status, "trashed"))
        .orderBy(desc(schema.festivals.updatedAt)),
      db
        .select({
          album: schema.albums,
          festival: schema.festivals,
        })
        .from(schema.albums)
        .leftJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
        .where(eq(schema.albums.status, "trashed"))
        .orderBy(desc(schema.albums.updatedAt)),
      db
        .select({
          img: schema.images,
          album: schema.albums,
        })
        .from(schema.images)
        .leftJoin(schema.albums, eq(schema.images.albumId, schema.albums.id))
        .where(or(eq(schema.images.status, "trashed"), sql`${schema.images.deletedAt} IS NOT NULL`))
        .orderBy(desc(schema.images.updatedAt))
        .limit(200),
      db
        .select({
          video: schema.videos,
          album: schema.albums,
        })
        .from(schema.videos)
        .leftJoin(schema.albums, eq(schema.videos.albumId, schema.albums.id))
        .where(or(eq(schema.videos.status, "trashed"), sql`${schema.videos.deletedAt} IS NOT NULL`))
        .orderBy(desc(schema.videos.updatedAt))
        .limit(200),
    ]);

    const mappedFestivals = trashedFestivals.map((f) => ({
      id: f.id,
      type: "festival" as const,
      name: f.name,
      title: f.name,
      emoji: f.emoji,
      month: f.month,
      deletedAt: f.updatedAt.toISOString(),
      trashedAt: f.updatedAt.toISOString(),
      canRestore: true,
    }));

    const mappedAlbums = trashedAlbums.map(({ album, festival }) => {
      const festivalActive = festival && festival.status !== "trashed";
      return {
        id: album.id,
        type: "album" as const,
        title: album.title,
        year: album.year,
        festivalId: album.festivalId,
        festivalName: festival?.name,
        photoCount: album.photoCount || 0,
        deletedAt: album.updatedAt.toISOString(),
        trashedAt: album.updatedAt.toISOString(),
        canRestore: !!festivalActive,
        blockReason: !festivalActive
          ? "ត្រូវស្តារប្រភេទបុណ្យឡើងវិញជាមុនសិន ទើបអាចស្តារ Album នេះបាន។"
          : undefined,
      };
    });

    const mappedImages = trashedImages.map(({ img, album }) => {
      const albumActive = album && album.status !== "trashed";
      return {
        id: img.id,
        type: "image" as const,
        title: img.title || img.description || "រូបភាព",
        description: img.description,
        url: img.url,
        thumbnailUrl: img.thumbnailUrl,
        albumId: img.albumId,
        albumTitle: album?.title,
        deletedAt: (img.deletedAt || img.updatedAt).toISOString(),
        trashedAt: (img.deletedAt || img.updatedAt).toISOString(),
        canRestore: !!albumActive,
        blockReason: !albumActive
          ? "ត្រូវស្តារ Album ឡើងវិញជាមុនសិន ទើបអាចស្តាររូបភាពនេះបាន។"
          : undefined,
      };
    });

    const mappedVideos = trashedVideos.map(({ video, album }) => {
      const albumActive = album && album.status !== "trashed";
      return {
        id: video.id,
        type: "video" as const,
        title: video.title || video.filename || "វីដេអូ",
        description: video.description,
        url: video.url,
        thumbnailUrl: video.thumbnailUrl,
        albumId: video.albumId,
        albumTitle: album?.title,
        size: video.size,
        mimeType: video.mimeType,
        deletedAt: (video.deletedAt || video.updatedAt).toISOString(),
        trashedAt: (video.deletedAt || video.updatedAt).toISOString(),
        canRestore: !!albumActive,
        blockReason: !albumActive
          ? "ត្រូវស្តារ Album ឡើងវិញជាមុនសិន ទើបអាចស្តារវីដេអូនេះបាន។"
          : undefined,
      };
    });

    const total = mappedFestivals.length + mappedAlbums.length + mappedImages.length + mappedVideos.length;

    return {
      festivals: mappedFestivals,
      years: [],
      albums: mappedAlbums,
      images: mappedImages,
      videos: mappedVideos,
      total,
    };
  } catch (err) {
    console.warn("[getAdminTrashItems Error]:", err);
    return {
      festivals: [],
      years: [],
      albums: [],
      images: [],
      videos: [],
      total: 0,
    };
  }
}

// =========================================================================
// PHASE 3.1 — VISITOR TRACKING + VIEWS ANALYTICS (POSTGRESQL & DRIZZLE)
// =========================================================================

// Deduplication cache for view events (key: `${resourceType}:${resourceId}:${visitorId}`, val: timestamp)
const viewDedupeCache = new Map<string, number>();

export type ReportPeriod =
  "today" | "yesterday" | "7d" | "30d" | "90d" | "this_year" | "all" | "custom";

export function getPhnomPenhDateBounds(
  period: ReportPeriod | string = "today",
  customStartDate?: string | Date | null,
  customEndDate?: string | Date | null,
): { startDate: Date; endDate: Date; daysCount: number } {
  const now = new Date();
  const OFFSET_MS = 7 * 60 * 60 * 1000;
  const ppNow = new Date(now.getTime() + OFFSET_MS);

  if (period === "all") {
    return { startDate: new Date(0), endDate: now, daysCount: 365 };
  }

  if (period === "custom" && customStartDate) {
    const start = new Date(customStartDate);
    const end = customEndDate ? new Date(customEndDate) : now;
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      if (typeof customEndDate === "string" && customEndDate.length === 10) {
        end.setHours(23, 59, 59, 999);
      }
      const daysCount = Math.max(
        1,
        Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)),
      );
      return { startDate: start, endDate: end, daysCount };
    }
  }

  const ppYear = ppNow.getUTCFullYear();
  const ppMonth = ppNow.getUTCMonth();
  const ppDate = ppNow.getUTCDate();

  const startOfTodayUtc = new Date(Date.UTC(ppYear, ppMonth, ppDate) - OFFSET_MS);

  if (period === "today") {
    return { startDate: startOfTodayUtc, endDate: now, daysCount: 1 };
  }

  if (period === "yesterday") {
    const startOfYesterday = new Date(startOfTodayUtc.getTime() - 24 * 60 * 60 * 1000);
    const endOfYesterday = new Date(startOfTodayUtc.getTime() - 1);
    return { startDate: startOfYesterday, endDate: endOfYesterday, daysCount: 1 };
  }

  if (period === "7d") {
    const start7d = new Date(startOfTodayUtc.getTime() - 6 * 24 * 60 * 60 * 1000);
    return { startDate: start7d, endDate: now, daysCount: 7 };
  }

  if (period === "30d") {
    const start30d = new Date(startOfTodayUtc.getTime() - 29 * 24 * 60 * 60 * 1000);
    return { startDate: start30d, endDate: now, daysCount: 30 };
  }

  if (period === "90d") {
    const start90d = new Date(startOfTodayUtc.getTime() - 89 * 24 * 60 * 60 * 1000);
    return { startDate: start90d, endDate: now, daysCount: 90 };
  }

  if (period === "this_year") {
    const startOfYearUtc = new Date(Date.UTC(ppYear, 0, 1) - OFFSET_MS);
    const daysCount = Math.max(
      1,
      Math.ceil((now.getTime() - startOfYearUtc.getTime()) / (24 * 60 * 60 * 1000)),
    );
    return { startDate: startOfYearUtc, endDate: now, daysCount };
  }

  const start7d = new Date(startOfTodayUtc.getTime() - 6 * 24 * 60 * 60 * 1000);
  return { startDate: start7d, endDate: now, daysCount: 7 };
}

export function getPreviousPhnomPenhDateBounds(
  period: ReportPeriod | string = "today",
  customStartDate?: string | Date | null,
  customEndDate?: string | Date | null,
): { startDate: Date; endDate: Date; daysCount: number } | null {
  if (period === "all") return null;

  const OFFSET_MS = 7 * 60 * 60 * 1000;
  const currentBounds = getPhnomPenhDateBounds(period, customStartDate, customEndDate);
  const durationMs = currentBounds.endDate.getTime() - currentBounds.startDate.getTime();
  const daysCount = currentBounds.daysCount;

  if (period === "today") {
    const now = new Date();
    const ppNow = new Date(now.getTime() + OFFSET_MS);
    const ppYear = ppNow.getUTCFullYear();
    const ppMonth = ppNow.getUTCMonth();
    const ppDate = ppNow.getUTCDate();
    const startOfTodayUtc = new Date(Date.UTC(ppYear, ppMonth, ppDate) - OFFSET_MS);
    const startOfYesterday = new Date(startOfTodayUtc.getTime() - 24 * 60 * 60 * 1000);
    const endOfYesterday = new Date(startOfTodayUtc.getTime() - 1);
    return { startDate: startOfYesterday, endDate: endOfYesterday, daysCount: 1 };
  }

  if (period === "yesterday") {
    const now = new Date();
    const ppNow = new Date(now.getTime() + OFFSET_MS);
    const ppYear = ppNow.getUTCFullYear();
    const ppMonth = ppNow.getUTCMonth();
    const ppDate = ppNow.getUTCDate();
    const startOfTodayUtc = new Date(Date.UTC(ppYear, ppMonth, ppDate) - OFFSET_MS);
    const startOf2DaysAgo = new Date(startOfTodayUtc.getTime() - 2 * 24 * 60 * 60 * 1000);
    const endOf2DaysAgo = new Date(startOfTodayUtc.getTime() - 24 * 60 * 60 * 1000 - 1);
    return { startDate: startOf2DaysAgo, endDate: endOf2DaysAgo, daysCount: 1 };
  }

  if (period === "this_year") {
    const now = new Date();
    const ppNow = new Date(now.getTime() + OFFSET_MS);
    const ppYear = ppNow.getUTCFullYear();
    const startOfLastYear = new Date(Date.UTC(ppYear - 1, 0, 1) - OFFSET_MS);
    const endOfLastYear = new Date(Date.UTC(ppYear, 0, 1) - OFFSET_MS - 1);
    return { startDate: startOfLastYear, endDate: endOfLastYear, daysCount };
  }

  const prevEnd = new Date(currentBounds.startDate.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return { startDate: prevStart, endDate: prevEnd, daysCount };
}

/**
 * 1. Record or update an anonymous / authenticated visitor session.
 */
export async function recordPostgresVisitorSession(session: {
  id: string;
  ipHash?: string | undefined;
  userAgent?: string | undefined;
  userId?: string | undefined;
  device?: string | undefined;
}): Promise<boolean> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return false;
  }

  try {
    const cleanId = session.id.trim();
    if (!cleanId) return false;

    const now = new Date();
    await db
      .insert(schema.visitorSessions)
      .values({
        id: cleanId,
        ipHash: session.ipHash || null,
        userAgent: session.userAgent || null,
        userId: session.userId || null,
        device: session.device || null,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.visitorSessions.id,
        set: {
          lastSeenAt: now,
          updatedAt: now,
          ...(session.userId ? { userId: session.userId } : {}),
          ...(session.device ? { device: session.device } : {}),
          ...(session.userAgent ? { userAgent: session.userAgent } : {}),
        },
      });

    return true;
  } catch (err) {
    console.warn("[recordPostgresVisitorSession Warning]:", err);
    return false;
  }
}

/**
 * 2. Record a page, album, or image view with deduplication & counter increment.
 */
export async function recordPostgresView(event: {
  resourceType: "page" | "album" | "image";
  resourceId: string;
  visitorId: string;
  userId?: string | undefined;
}): Promise<{ recorded: boolean; deduplicated: boolean }> {
  const db = getDrizzleDb();
  const { resourceType, resourceId, visitorId, userId } = event;

  if (!resourceId || !visitorId) {
    return { recorded: false, deduplicated: false };
  }

  const dedupeKey = `${resourceType}:${resourceId}:${visitorId}`;
  const nowMs = Date.now();
  const lastViewTime = viewDedupeCache.get(dedupeKey);

  // Deduplicate views from the exact same visitor + resource within 30 seconds
  if (lastViewTime && nowMs - lastViewTime < 30_000) {
    return { recorded: false, deduplicated: true };
  }

  viewDedupeCache.set(dedupeKey, nowMs);

  if (!db || !isPostgresConfigured()) {
    return { recorded: true, deduplicated: false };
  }

  try {
    // If it's an album view, check album existence
    if (resourceType === "album") {
      const albumExists = await db
        .select({ id: schema.albums.id })
        .from(schema.albums)
        .where(eq(schema.albums.id, resourceId))
        .limit(1);

      if (albumExists.length === 0) {
        return { recorded: false, deduplicated: false };
      }
    } else if (resourceType === "image") {
      const imageExists = await db
        .select({ id: schema.images.id })
        .from(schema.images)
        .where(eq(schema.images.id, resourceId))
        .limit(1);

      if (imageExists.length === 0) {
        return { recorded: false, deduplicated: false };
      }
    }

    const now = new Date();

    // 1. Insert into views_log
    await db.insert(schema.viewsLog).values({
      resourceType,
      resourceId,
      visitorId,
      userId: userId || null,
      createdAt: now,
    });

    // 2. Increment counters
    if (resourceType === "album") {
      await db
        .update(schema.albums)
        .set({
          viewsCount: sql`${schema.albums.viewsCount} + 1`,
          updatedAt: now,
        })
        .where(eq(schema.albums.id, resourceId));
    } else if (resourceType === "image") {
      await db
        .update(schema.images)
        .set({
          viewsCount: sql`${schema.images.viewsCount} + 1`,
          updatedAt: now,
        })
        .where(eq(schema.images.id, resourceId));
    }

    // 3. Touch visitor session
    await db
      .update(schema.visitorSessions)
      .set({
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(eq(schema.visitorSessions.id, visitorId));

    return { recorded: true, deduplicated: false };
  } catch (err) {
    console.warn("[recordPostgresView Warning]:", err);
    return { recorded: false, deduplicated: false };
  }
}

export interface AdminAnalyticsOverview {
  visitorsToday: number;
  visitorsThisWeek: number;
  visitorsThisMonth: number;
  totalVisitors: number;
  pageViewsToday: number;
  pageViewsThisWeek: number;
  pageViewsThisMonth: number;
  totalPageViews: number;
  totalAlbumViews: number;
  totalImageViews: number;
  totalViews: number;
  period: "today" | "7d" | "30d" | "all";
  currentPeriodVisitors: number;
  currentPeriodPageViews: number;
  currentPeriodAlbumViews: number;
  currentPeriodImageViews: number;
  currentPeriodTotalViews: number;
}

/**
 * 3. Aggregated Admin Analytics Overview
 */
export async function getPostgresAnalyticsOverview(
  period: "today" | "7d" | "30d" | "all" = "today",
): Promise<AdminAnalyticsOverview> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return {
      visitorsToday: 0,
      visitorsThisWeek: 0,
      visitorsThisMonth: 0,
      totalVisitors: 0,
      pageViewsToday: 0,
      pageViewsThisWeek: 0,
      pageViewsThisMonth: 0,
      totalPageViews: 0,
      totalAlbumViews: 0,
      totalImageViews: 0,
      totalViews: 0,
      period,
      currentPeriodVisitors: 0,
      currentPeriodPageViews: 0,
      currentPeriodAlbumViews: 0,
      currentPeriodImageViews: 0,
      currentPeriodTotalViews: 0,
    };
  }

  try {
    const { startDate: startToday } = getPhnomPenhDateBounds("today");
    const { startDate: start7d } = getPhnomPenhDateBounds("7d");
    const { startDate: start30d } = getPhnomPenhDateBounds("30d");
    const { startDate: startPeriod } = getPhnomPenhDateBounds(period);

    const [
      visitorsTodayRes,
      visitors7dRes,
      visitors30dRes,
      totalVisitorsRes,
      pageViewsTodayRes,
      pageViews7dRes,
      pageViews30dRes,
      totalPageViewsRes,
      totalAlbumViewsRes,
      totalImageViewsRes,
      periodVisitorsRes,
      periodPageViewsRes,
      periodAlbumViewsRes,
      periodImageViewsRes,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(distinct ${schema.viewsLog.visitorId})` })
        .from(schema.viewsLog)
        .where(gte(schema.viewsLog.createdAt, startToday)),
      db
        .select({ count: sql<number>`count(distinct ${schema.viewsLog.visitorId})` })
        .from(schema.viewsLog)
        .where(gte(schema.viewsLog.createdAt, start7d)),
      db
        .select({ count: sql<number>`count(distinct ${schema.viewsLog.visitorId})` })
        .from(schema.viewsLog)
        .where(gte(schema.viewsLog.createdAt, start30d)),
      db.select({ count: sql<number>`count(*)` }).from(schema.visitorSessions),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.viewsLog)
        .where(
          and(eq(schema.viewsLog.resourceType, "page"), gte(schema.viewsLog.createdAt, startToday)),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.viewsLog)
        .where(
          and(eq(schema.viewsLog.resourceType, "page"), gte(schema.viewsLog.createdAt, start7d)),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.viewsLog)
        .where(
          and(eq(schema.viewsLog.resourceType, "page"), gte(schema.viewsLog.createdAt, start30d)),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.viewsLog)
        .where(eq(schema.viewsLog.resourceType, "page")),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.viewsLog)
        .where(eq(schema.viewsLog.resourceType, "album")),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.viewsLog)
        .where(eq(schema.viewsLog.resourceType, "image")),
      // Current Period
      period === "all"
        ? db.select({ count: sql<number>`count(*)` }).from(schema.visitorSessions)
        : db
            .select({ count: sql<number>`count(distinct ${schema.viewsLog.visitorId})` })
            .from(schema.viewsLog)
            .where(gte(schema.viewsLog.createdAt, startPeriod)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.viewsLog)
        .where(
          period === "all"
            ? eq(schema.viewsLog.resourceType, "page")
            : and(
                eq(schema.viewsLog.resourceType, "page"),
                gte(schema.viewsLog.createdAt, startPeriod),
              ),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.viewsLog)
        .where(
          period === "all"
            ? eq(schema.viewsLog.resourceType, "album")
            : and(
                eq(schema.viewsLog.resourceType, "album"),
                gte(schema.viewsLog.createdAt, startPeriod),
              ),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.viewsLog)
        .where(
          period === "all"
            ? eq(schema.viewsLog.resourceType, "image")
            : and(
                eq(schema.viewsLog.resourceType, "image"),
                gte(schema.viewsLog.createdAt, startPeriod),
              ),
        ),
    ]);

    const visitorsToday = Number(visitorsTodayRes[0]?.count || 0);
    const visitorsThisWeek = Number(visitors7dRes[0]?.count || 0);
    const visitorsThisMonth = Number(visitors30dRes[0]?.count || 0);
    const totalVisitors = Number(totalVisitorsRes[0]?.count || 0);

    const pageViewsToday = Number(pageViewsTodayRes[0]?.count || 0);
    const pageViewsThisWeek = Number(pageViews7dRes[0]?.count || 0);
    const pageViewsThisMonth = Number(pageViews30dRes[0]?.count || 0);
    const totalPageViews = Number(totalPageViewsRes[0]?.count || 0);
    const totalAlbumViews = Number(totalAlbumViewsRes[0]?.count || 0);
    const totalImageViews = Number(totalImageViewsRes[0]?.count || 0);
    const totalViews = totalPageViews + totalAlbumViews + totalImageViews;

    const currentPeriodVisitors = Number(periodVisitorsRes[0]?.count || 0);
    const currentPeriodPageViews = Number(periodPageViewsRes[0]?.count || 0);
    const currentPeriodAlbumViews = Number(periodAlbumViewsRes[0]?.count || 0);
    const currentPeriodImageViews = Number(periodImageViewsRes[0]?.count || 0);
    const currentPeriodTotalViews =
      currentPeriodPageViews + currentPeriodAlbumViews + currentPeriodImageViews;

    return {
      visitorsToday,
      visitorsThisWeek,
      visitorsThisMonth,
      totalVisitors,
      pageViewsToday,
      pageViewsThisWeek,
      pageViewsThisMonth,
      totalPageViews,
      totalAlbumViews,
      totalImageViews,
      totalViews,
      period,
      currentPeriodVisitors,
      currentPeriodPageViews,
      currentPeriodAlbumViews,
      currentPeriodImageViews,
      currentPeriodTotalViews,
    };
  } catch (err) {
    console.warn("[getPostgresAnalyticsOverview Error]:", err);
    return {
      visitorsToday: 0,
      visitorsThisWeek: 0,
      visitorsThisMonth: 0,
      totalVisitors: 0,
      pageViewsToday: 0,
      pageViewsThisWeek: 0,
      pageViewsThisMonth: 0,
      totalPageViews: 0,
      totalAlbumViews: 0,
      totalImageViews: 0,
      totalViews: 0,
      period,
      currentPeriodVisitors: 0,
      currentPeriodPageViews: 0,
      currentPeriodAlbumViews: 0,
      currentPeriodImageViews: 0,
      currentPeriodTotalViews: 0,
    };
  }
}

export interface ViewsSeriesPoint {
  date: string;
  label: string;
  visitors: number;
  pageViews: number;
  albumViews: number;
  imageViews: number;
  totalViews: number;
}

/**
 * 4. Time Series for Views & Visitors charts (Today hourly or 7d/30d daily)
 */
export async function getPostgresAnalyticsViewsSeries(
  period: "today" | "7d" | "30d" = "7d",
): Promise<ViewsSeriesPoint[]> {
  const db = getDrizzleDb();
  const KHMER_DAYS = ["អាទិត្យ", "ចន្ទ", "អង្គារ", "ពុធ", "ព្រហស្បតិ៍", "សុក្រ", "សៅរ៍"];
  const OFFSET_MS = 7 * 60 * 60 * 1000;

  if (!db || !isPostgresConfigured()) {
    // Generate empty placeholder series
    const daysCount = period === "today" ? 12 : period === "7d" ? 7 : 30;
    const now = new Date();
    const result: ViewsSeriesPoint[] = [];

    if (period === "today") {
      for (let h = 0; h < 24; h += 2) {
        result.push({
          date: `${h}:00`,
          label: `${h}:00`,
          visitors: 0,
          pageViews: 0,
          albumViews: 0,
          imageViews: 0,
          totalViews: 0,
        });
      }
    } else {
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now.getTime() + OFFSET_MS - i * 24 * 60 * 60 * 1000);
        const dayOfWeek = KHMER_DAYS[d.getUTCDay()];
        const dateNum = d.getUTCDate();
        const dateStr = d.toISOString().split("T")[0]!;
        result.push({
          date: dateStr,
          label: `${dayOfWeek} ${dateNum}`,
          visitors: 0,
          pageViews: 0,
          albumViews: 0,
          imageViews: 0,
          totalViews: 0,
        });
      }
    }
    return result;
  }

  try {
    const { startDate } = getPhnomPenhDateBounds(period);
    const now = new Date();

    const rawViews = await db
      .select({
        resourceType: schema.viewsLog.resourceType,
        visitorId: schema.viewsLog.visitorId,
        createdAt: schema.viewsLog.createdAt,
      })
      .from(schema.viewsLog)
      .where(gte(schema.viewsLog.createdAt, startDate))
      .orderBy(asc(schema.viewsLog.createdAt));

    if (period === "today") {
      // 2-hour interval slots
      const slots: Record<
        number,
        {
          visitors: Set<string>;
          pageViews: number;
          albumViews: number;
          imageViews: number;
        }
      > = {};

      for (let h = 0; h < 24; h += 2) {
        slots[h] = {
          visitors: new Set(),
          pageViews: 0,
          albumViews: 0,
          imageViews: 0,
        };
      }

      for (const row of rawViews) {
        const rowPP = new Date(row.createdAt.getTime() + OFFSET_MS);
        const hour = Math.floor(rowPP.getUTCHours() / 2) * 2;
        if (slots[hour]) {
          slots[hour].visitors.add(row.visitorId);
          if (row.resourceType === "page") slots[hour].pageViews++;
          else if (row.resourceType === "album") slots[hour].albumViews++;
          else if (row.resourceType === "image") slots[hour].imageViews++;
        }
      }

      return Object.entries(slots).map(([hourStr, val]) => {
        const h = parseInt(hourStr, 10);
        const total = val.pageViews + val.albumViews + val.imageViews;
        return {
          date: `${h.toString().padStart(2, "0")}:00`,
          label: `${h.toString().padStart(2, "0")}:00`,
          visitors: val.visitors.size,
          pageViews: val.pageViews,
          albumViews: val.albumViews,
          imageViews: val.imageViews,
          totalViews: total,
        };
      });
    } else {
      // Daily intervals
      const daysCount = period === "7d" ? 7 : 30;
      const daySlots: Record<
        string,
        {
          label: string;
          visitors: Set<string>;
          pageViews: number;
          albumViews: number;
          imageViews: number;
        }
      > = {};

      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now.getTime() + OFFSET_MS - i * 24 * 60 * 60 * 1000);
        const dayOfWeek = KHMER_DAYS[d.getUTCDay()];
        const dateNum = d.getUTCDate();
        const dateStr = d.toISOString().split("T")[0]!;
        daySlots[dateStr] = {
          label: `${dayOfWeek} ${dateNum}`,
          visitors: new Set(),
          pageViews: 0,
          albumViews: 0,
          imageViews: 0,
        };
      }

      for (const row of rawViews) {
        const rowPP = new Date(row.createdAt.getTime() + OFFSET_MS);
        const dateStr = rowPP.toISOString().split("T")[0]!;
        if (daySlots[dateStr]) {
          daySlots[dateStr].visitors.add(row.visitorId);
          if (row.resourceType === "page") daySlots[dateStr].pageViews++;
          else if (row.resourceType === "album") daySlots[dateStr].albumViews++;
          else if (row.resourceType === "image") daySlots[dateStr].imageViews++;
        }
      }

      return Object.entries(daySlots).map(([dateStr, val]) => {
        const total = val.pageViews + val.albumViews + val.imageViews;
        return {
          date: dateStr,
          label: val.label,
          visitors: val.visitors.size,
          pageViews: val.pageViews,
          albumViews: val.albumViews,
          imageViews: val.imageViews,
          totalViews: total,
        };
      });
    }
  } catch (err) {
    console.warn("[getPostgresAnalyticsViewsSeries Error]:", err);
    return [];
  }
}

export interface TopAlbumItem {
  rank: number;
  albumId: string;
  title: string;
  festivalName: string;
  festivalEmoji: string;
  festivalAccent: string;
  year: number;
  coverImage?: string | null | undefined;
  photoCount: number;
  views: number;
}

/**
 * 5. Most Viewed Albums
 */
export async function getPostgresTopAlbums(
  period: "today" | "7d" | "30d" | "all" = "all",
  limit = 10,
): Promise<TopAlbumItem[]> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return [];
  }

  try {
    if (period === "all") {
      // Use indexed albums.views_count
      const rows = await db
        .select({
          album: schema.albums,
          festival: schema.festivals,
        })
        .from(schema.albums)
        .leftJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
        .where(eq(schema.albums.status, "published"))
        .orderBy(desc(schema.albums.viewsCount))
        .limit(limit);

      return rows.map((r, idx) => ({
        rank: idx + 1,
        albumId: r.album.id,
        title: r.album.title,
        festivalName: r.festival?.name || "ពិធីបុណ្យ",
        festivalEmoji: r.festival?.emoji || "🏮",
        festivalAccent: r.festival?.accent || "#d4af37",
        year: r.album.year,
        coverImage: r.album.coverImage,
        photoCount: r.album.photoCount,
        views: r.album.viewsCount || 0,
      }));
    } else {
      // Aggregate from views_log within time bounds
      const { startDate } = getPhnomPenhDateBounds(period);
      const topLogged = await db
        .select({
          albumId: schema.viewsLog.resourceId,
          count: sql<number>`count(*)`.as("views_count"),
        })
        .from(schema.viewsLog)
        .where(
          and(eq(schema.viewsLog.resourceType, "album"), gte(schema.viewsLog.createdAt, startDate)),
        )
        .groupBy(schema.viewsLog.resourceId)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);

      if (topLogged.length === 0) {
        // Fallback to top albums by total count if no log entries in period
        return getPostgresTopAlbums("all", limit);
      }

      const results: TopAlbumItem[] = [];
      for (let i = 0; i < topLogged.length; i++) {
        const item = topLogged[i];
        if (!item) continue;
        const albumData = await db
          .select({
            album: schema.albums,
            festival: schema.festivals,
          })
          .from(schema.albums)
          .leftJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
          .where(eq(schema.albums.id, item.albumId))
          .limit(1);

        if (albumData[0]) {
          const r = albumData[0];
          results.push({
            rank: i + 1,
            albumId: r.album.id,
            title: r.album.title,
            festivalName: r.festival?.name || "ពិធីបុណ្យ",
            festivalEmoji: r.festival?.emoji || "🏮",
            festivalAccent: r.festival?.accent || "#d4af37",
            year: r.album.year,
            coverImage: r.album.coverImage,
            photoCount: r.album.photoCount,
            views: Number(item.count),
          });
        }
      }

      return results;
    }
  } catch (err) {
    console.warn("[getPostgresTopAlbums Error]:", err);
    return [];
  }
}

export interface TopImageItem {
  rank: number;
  imageId: string;
  title: string;
  url: string;
  thumbnailUrl?: string | null | undefined;
  albumId: string;
  albumTitle: string;
  year?: number | undefined;
  festivalName?: string | undefined;
  views: number;
}

/**
 * 6. Most Viewed Images
 */
export async function getPostgresTopImages(
  period: "today" | "7d" | "30d" | "all" = "all",
  limit = 10,
): Promise<TopImageItem[]> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return [];
  }

  try {
    if (period === "all") {
      const rows = await db
        .select({
          img: schema.images,
          album: schema.albums,
          festival: schema.festivals,
        })
        .from(schema.images)
        .leftJoin(schema.albums, eq(schema.images.albumId, schema.albums.id))
        .leftJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
        .where(and(eq(schema.images.status, "published"), sql`${schema.images.deletedAt} IS NULL`))
        .orderBy(desc(schema.images.viewsCount))
        .limit(limit);

      return rows.map((r, idx) => ({
        rank: idx + 1,
        imageId: r.img.id,
        title: r.img.title,
        url: r.img.url,
        thumbnailUrl: r.img.thumbnailUrl,
        albumId: r.img.albumId,
        albumTitle: r.album?.title || "Album",
        year: r.album?.year,
        festivalName: r.festival?.name,
        views: r.img.viewsCount || 0,
      }));
    } else {
      const { startDate } = getPhnomPenhDateBounds(period);
      const topLogged = await db
        .select({
          imageId: schema.viewsLog.resourceId,
          count: sql<number>`count(*)`.as("views_count"),
        })
        .from(schema.viewsLog)
        .where(
          and(eq(schema.viewsLog.resourceType, "image"), gte(schema.viewsLog.createdAt, startDate)),
        )
        .groupBy(schema.viewsLog.resourceId)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);

      if (topLogged.length === 0) {
        return getPostgresTopImages("all", limit);
      }

      const results: TopImageItem[] = [];
      for (let i = 0; i < topLogged.length; i++) {
        const item = topLogged[i];
        if (!item) continue;
        const imgData = await db
          .select({
            img: schema.images,
            album: schema.albums,
            festival: schema.festivals,
          })
          .from(schema.images)
          .leftJoin(schema.albums, eq(schema.images.albumId, schema.albums.id))
          .leftJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
          .where(eq(schema.images.id, item.imageId))
          .limit(1);

        if (imgData[0]) {
          const r = imgData[0];
          results.push({
            rank: i + 1,
            imageId: r.img.id,
            title: r.img.title,
            url: r.img.url,
            thumbnailUrl: r.img.thumbnailUrl,
            albumId: r.img.albumId,
            albumTitle: r.album?.title || "Album",
            year: r.album?.year,
            festivalName: r.festival?.name,
            views: Number(item.count),
          });
        }
      }

      return results;
    }
  } catch (err) {
    console.warn("[getPostgresTopImages Error]:", err);
    return [];
  }
}

// --- PHASE 3.2: LIKES & FAVORITES QUERIES ---

export interface FavoritedAlbumItem {
  id: string;
  festivalId: string;
  festivalName: string;
  festivalEmoji: string;
  festivalAccent: string;
  year: number;
  location?: string | undefined;
  title: string;
  description?: string | undefined;
  photoCount: number;
  coverImage?: string | undefined;
  favoritedAt: string;
}

export interface FavoritedImageItem {
  id: string;
  albumId: string;
  albumTitle: string;
  year?: number | undefined;
  festivalName?: string | undefined;
  title: string;
  url: string;
  thumbnailUrl?: string | undefined;
  favoritedAt: string;
}

export interface InteractionsAnalyticsData {
  likes: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  favorites: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  topLikedAlbums: Array<{
    rank: number;
    albumId: string;
    title: string;
    festivalName: string;
    festivalEmoji: string;
    year: number;
    coverImage?: string | null | undefined;
    likesCount: number;
  }>;
  topLikedImages: Array<{
    rank: number;
    imageId: string;
    title: string;
    albumTitle: string;
    festivalName?: string | null | undefined;
    year?: number | null | undefined;
    url: string;
    thumbnailUrl?: string | null | undefined;
    likesCount: number;
  }>;
  topFavoritedAlbums: Array<{
    rank: number;
    albumId: string;
    title: string;
    festivalName: string;
    festivalEmoji: string;
    year: number;
    coverImage?: string | null | undefined;
    favoritesCount: number;
  }>;
  topFavoritedImages: Array<{
    rank: number;
    imageId: string;
    title: string;
    albumTitle: string;
    festivalName?: string | null | undefined;
    year?: number | null | undefined;
    url: string;
    thumbnailUrl?: string | null | undefined;
    favoritesCount: number;
  }>;
}

/**
 * Get like status and total count for a resource from Postgres
 */
export async function getPostgresLikeStatus(
  resourceType: "album" | "image",
  resourceId: string,
  visitorId?: string,
  userId?: string,
): Promise<{ liked: boolean; count: number }> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return { liked: false, count: 0 };
  }

  try {
    // 1. Get exact count from likes table
    const countRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.likes)
      .where(
        and(eq(schema.likes.resourceType, resourceType), eq(schema.likes.resourceId, resourceId)),
      );
    const count = Number(countRes[0]?.count || 0);

    // 2. Check if identity has liked
    let liked = false;
    if (visitorId || userId) {
      const conditions = [];
      if (visitorId) conditions.push(eq(schema.likes.visitorId, visitorId));
      if (userId) conditions.push(eq(schema.likes.userId, userId));

      const hasLiked = await db
        .select({ id: schema.likes.id })
        .from(schema.likes)
        .where(
          and(
            eq(schema.likes.resourceType, resourceType),
            eq(schema.likes.resourceId, resourceId),
            or(...conditions),
          ),
        )
        .limit(1);

      liked = Boolean(hasLiked && hasLiked.length > 0);
    }

    return { liked, count };
  } catch (err) {
    console.warn("[getPostgresLikeStatus Error]:", err);
    return { liked: false, count: 0 };
  }
}

/**
 * Record a like in Postgres
 */
export async function recordPostgresLike(
  resourceType: "album" | "image",
  resourceId: string,
  visitorId: string,
  userId?: string,
): Promise<{ liked: boolean; count: number; alreadyLiked: boolean }> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return { liked: true, count: 1, alreadyLiked: false };
  }

  try {
    // Check if already liked
    const conditions = [eq(schema.likes.visitorId, visitorId)];
    if (userId) conditions.push(eq(schema.likes.userId, userId));

    const existing = await db
      .select({ id: schema.likes.id })
      .from(schema.likes)
      .where(
        and(
          eq(schema.likes.resourceType, resourceType),
          eq(schema.likes.resourceId, resourceId),
          or(...conditions),
        ),
      )
      .limit(1);

    if (existing && existing.length > 0) {
      const current = await getPostgresLikeStatus(resourceType, resourceId, visitorId, userId);
      return { liked: true, count: current.count, alreadyLiked: true };
    }

    // Insert new like
    await db.insert(schema.likes).values({
      resourceType,
      resourceId,
      visitorId,
      userId: userId || null,
      createdAt: new Date(),
    });

    // Update denormalized count on album or image
    if (resourceType === "album") {
      await db
        .update(schema.albums)
        .set({
          likesCount: sql`${schema.albums.likesCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.albums.id, resourceId));
    } else if (resourceType === "image") {
      await db
        .update(schema.images)
        .set({
          likesCount: sql`${schema.images.likesCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.images.id, resourceId));
    }

    const updated = await getPostgresLikeStatus(resourceType, resourceId, visitorId, userId);
    return { liked: true, count: updated.count, alreadyLiked: false };
  } catch (err) {
    console.warn("[recordPostgresLike Error]:", err);
    return { liked: true, count: 1, alreadyLiked: false };
  }
}

/**
 * Remove a like from Postgres
 */
export async function removePostgresLike(
  resourceType: "album" | "image",
  resourceId: string,
  visitorId: string,
  userId?: string,
): Promise<{ liked: boolean; count: number }> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return { liked: false, count: 0 };
  }

  try {
    const conditions = [eq(schema.likes.visitorId, visitorId)];
    if (userId) conditions.push(eq(schema.likes.userId, userId));

    const deleted = await db
      .delete(schema.likes)
      .where(
        and(
          eq(schema.likes.resourceType, resourceType),
          eq(schema.likes.resourceId, resourceId),
          or(...conditions),
        ),
      )
      .returning({ id: schema.likes.id });

    if (deleted && deleted.length > 0) {
      // Decrement count on album or image
      if (resourceType === "album") {
        await db
          .update(schema.albums)
          .set({
            likesCount: sql`GREATEST(0, ${schema.albums.likesCount} - 1)`,
            updatedAt: new Date(),
          })
          .where(eq(schema.albums.id, resourceId));
      } else if (resourceType === "image") {
        await db
          .update(schema.images)
          .set({
            likesCount: sql`GREATEST(0, ${schema.images.likesCount} - 1)`,
            updatedAt: new Date(),
          })
          .where(eq(schema.images.id, resourceId));
      }
    }

    const updated = await getPostgresLikeStatus(resourceType, resourceId, visitorId, userId);
    return { liked: false, count: updated.count };
  } catch (err) {
    console.warn("[removePostgresLike Error]:", err);
    return { liked: false, count: 0 };
  }
}

/**
 * Check if a resource is favorited
 */
export async function getPostgresFavoriteStatus(
  resourceType: "album" | "image",
  resourceId: string,
  visitorId?: string,
  userId?: string,
): Promise<boolean> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured() || (!visitorId && !userId)) {
    return false;
  }

  try {
    const conditions = [];
    if (visitorId) conditions.push(eq(schema.favorites.visitorId, visitorId));
    if (userId) conditions.push(eq(schema.favorites.userId, userId));

    const rows = await db
      .select({ id: schema.favorites.id })
      .from(schema.favorites)
      .where(
        and(
          or(
            and(
              eq(schema.favorites.resourceType, resourceType),
              eq(schema.favorites.resourceId, resourceId),
            ),
            resourceType === "image" ? eq(schema.favorites.imageId, resourceId) : sql`false`,
          ),
          or(...conditions),
        ),
      )
      .limit(1);

    return Boolean(rows && rows.length > 0);
  } catch (err) {
    console.warn("[getPostgresFavoriteStatus Error]:", err);
    return false;
  }
}

/**
 * Record a favorite in Postgres
 */
export async function recordPostgresFavorite(
  resourceType: "album" | "image",
  resourceId: string,
  visitorId: string,
  userId?: string,
): Promise<{ favorited: boolean; alreadyFavorited: boolean }> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return { favorited: true, alreadyFavorited: false };
  }

  try {
    const conditions = [eq(schema.favorites.visitorId, visitorId)];
    if (userId) conditions.push(eq(schema.favorites.userId, userId));

    const existing = await db
      .select({ id: schema.favorites.id })
      .from(schema.favorites)
      .where(
        and(
          or(
            and(
              eq(schema.favorites.resourceType, resourceType),
              eq(schema.favorites.resourceId, resourceId),
            ),
            resourceType === "image" ? eq(schema.favorites.imageId, resourceId) : sql`false`,
          ),
          or(...conditions),
        ),
      )
      .limit(1);

    if (existing && existing.length > 0) {
      return { favorited: true, alreadyFavorited: true };
    }

    await db.insert(schema.favorites).values({
      resourceType,
      resourceId,
      imageId: resourceType === "image" ? resourceId : null,
      visitorId,
      userId: userId || null,
      createdAt: new Date(),
    });

    return { favorited: true, alreadyFavorited: false };
  } catch (err) {
    console.warn("[recordPostgresFavorite Error]:", err);
    return { favorited: true, alreadyFavorited: false };
  }
}

/**
 * Remove a favorite from Postgres
 */
export async function removePostgresFavorite(
  resourceType: "album" | "image",
  resourceId: string,
  visitorId: string,
  userId?: string,
): Promise<{ favorited: boolean }> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return { favorited: false };
  }

  try {
    const conditions = [eq(schema.favorites.visitorId, visitorId)];
    if (userId) conditions.push(eq(schema.favorites.userId, userId));

    await db
      .delete(schema.favorites)
      .where(
        and(
          or(
            and(
              eq(schema.favorites.resourceType, resourceType),
              eq(schema.favorites.resourceId, resourceId),
            ),
            resourceType === "image" ? eq(schema.favorites.imageId, resourceId) : sql`false`,
          ),
          or(...conditions),
        ),
      );

    return { favorited: false };
  } catch (err) {
    console.warn("[removePostgresFavorite Error]:", err);
    return { favorited: false };
  }
}

/**
 * Retrieve user/visitor favorites from Postgres
 */
export async function getPostgresUserFavorites(
  visitorId?: string,
  userId?: string,
  resourceType: "album" | "image" | "all" = "all",
): Promise<{ albums: FavoritedAlbumItem[]; images: FavoritedImageItem[] }> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured() || (!visitorId && !userId)) {
    return { albums: [], images: [] };
  }

  try {
    const conditions = [];
    if (visitorId) conditions.push(eq(schema.favorites.visitorId, visitorId));
    if (userId) conditions.push(eq(schema.favorites.userId, userId));

    const favRows = await db
      .select()
      .from(schema.favorites)
      .where(or(...conditions))
      .orderBy(desc(schema.favorites.createdAt));

    const albumFavs = favRows.filter(
      (r) =>
        (r.resourceType === "album" || (!r.imageId && r.resourceId)) &&
        (resourceType === "all" || resourceType === "album"),
    );
    const imageFavs = favRows.filter(
      (r) =>
        (r.resourceType === "image" || r.imageId) &&
        (resourceType === "all" || resourceType === "image"),
    );

    const albums: FavoritedAlbumItem[] = [];
    for (const af of albumFavs) {
      const targetId = af.resourceId || af.imageId;
      if (!targetId) continue;
      const albumData = await db
        .select({
          album: schema.albums,
          festival: schema.festivals,
        })
        .from(schema.albums)
        .leftJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
        .where(and(eq(schema.albums.id, targetId), sql`${schema.albums.status} != 'trashed'`))
        .limit(1);

      if (albumData[0]) {
        const { album, festival } = albumData[0];
        albums.push({
          id: album.id,
          festivalId: album.festivalId,
          festivalName: festival?.name || "ពិធីបុណ្យ",
          festivalEmoji: festival?.emoji || "🏮",
          festivalAccent: festival?.accent || "#d4af37",
          year: album.year,
          location: album.location || undefined,
          title: album.title,
          description: album.description || undefined,
          photoCount: album.photoCount,
          coverImage: album.coverImage || undefined,
          favoritedAt: af.createdAt.toISOString(),
        });
      }
    }

    const images: FavoritedImageItem[] = [];
    for (const imgF of imageFavs) {
      const targetId = imgF.resourceId || imgF.imageId;
      if (!targetId) continue;
      const imgData = await db
        .select({
          img: schema.images,
          album: schema.albums,
          festival: schema.festivals,
        })
        .from(schema.images)
        .leftJoin(schema.albums, eq(schema.images.albumId, schema.albums.id))
        .leftJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
        .where(
          and(
            eq(schema.images.id, targetId),
            eq(schema.images.status, "published"),
            sql`${schema.images.deletedAt} IS NULL`,
          ),
        )
        .limit(1);

      if (imgData[0]) {
        const { img, album, festival } = imgData[0];
        images.push({
          id: img.id,
          albumId: img.albumId,
          albumTitle: album?.title || "Album",
          year: album?.year,
          festivalName: festival?.name,
          title: img.title,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl || img.url,
          favoritedAt: imgF.createdAt.toISOString(),
        });
      }
    }

    return { albums, images };
  } catch (err) {
    console.warn("[getPostgresUserFavorites Error]:", err);
    return { albums: [], images: [] };
  }
}

/**
 * Interactions Analytics aggregation query for admin
 */
export async function getPostgresInteractionsAnalytics(
  period: "today" | "7d" | "30d" | "all" = "all",
): Promise<InteractionsAnalyticsData> {
  const db = getDrizzleDb();
  const emptyRes: InteractionsAnalyticsData = {
    likes: { total: 0, today: 0, thisWeek: 0, thisMonth: 0 },
    favorites: { total: 0, today: 0, thisWeek: 0, thisMonth: 0 },
    topLikedAlbums: [],
    topLikedImages: [],
    topFavoritedAlbums: [],
    topFavoritedImages: [],
  };

  if (!db || !isPostgresConfigured()) {
    return emptyRes;
  }

  try {
    const { startDate: todayStart } = getPhnomPenhDateBounds("today");
    const { startDate: weekStart } = getPhnomPenhDateBounds("7d");
    const { startDate: monthStart } = getPhnomPenhDateBounds("30d");

    // 1. Likes counts
    const totalLikesRes = await db.select({ count: sql<number>`count(*)` }).from(schema.likes);
    const todayLikesRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.likes)
      .where(gte(schema.likes.createdAt, todayStart));
    const weekLikesRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.likes)
      .where(gte(schema.likes.createdAt, weekStart));
    const monthLikesRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.likes)
      .where(gte(schema.likes.createdAt, monthStart));

    // 2. Favorites counts
    const totalFavRes = await db.select({ count: sql<number>`count(*)` }).from(schema.favorites);
    const todayFavRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.favorites)
      .where(gte(schema.favorites.createdAt, todayStart));
    const weekFavRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.favorites)
      .where(gte(schema.favorites.createdAt, weekStart));
    const monthFavRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.favorites)
      .where(gte(schema.favorites.createdAt, monthStart));

    // 3. Top Liked Albums
    const topLikedAlbumsRaw = await db
      .select({
        albumId: schema.likes.resourceId,
        count: sql<number>`count(*)`.as("likes_count"),
      })
      .from(schema.likes)
      .where(eq(schema.likes.resourceType, "album"))
      .groupBy(schema.likes.resourceId)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    const topLikedAlbums = [];
    for (let i = 0; i < topLikedAlbumsRaw.length; i++) {
      const item = topLikedAlbumsRaw[i];
      if (!item) continue;
      const alb = await db
        .select({
          album: schema.albums,
          festival: schema.festivals,
        })
        .from(schema.albums)
        .leftJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
        .where(eq(schema.albums.id, item.albumId))
        .limit(1);

      if (alb[0]) {
        topLikedAlbums.push({
          rank: i + 1,
          albumId: alb[0].album.id,
          title: alb[0].album.title,
          festivalName: alb[0].festival?.name || "ពិធីបុណ្យ",
          festivalEmoji: alb[0].festival?.emoji || "🏮",
          year: alb[0].album.year,
          coverImage: alb[0].album.coverImage || undefined,
          likesCount: Number(item.count),
        });
      }
    }

    // 4. Top Liked Images
    const topLikedImagesRaw = await db
      .select({
        imageId: schema.likes.resourceId,
        count: sql<number>`count(*)`.as("likes_count"),
      })
      .from(schema.likes)
      .where(eq(schema.likes.resourceType, "image"))
      .groupBy(schema.likes.resourceId)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    const topLikedImages = [];
    for (let i = 0; i < topLikedImagesRaw.length; i++) {
      const item = topLikedImagesRaw[i];
      if (!item) continue;
      const imgData = await db
        .select({
          img: schema.images,
          album: schema.albums,
          festival: schema.festivals,
        })
        .from(schema.images)
        .leftJoin(schema.albums, eq(schema.images.albumId, schema.albums.id))
        .leftJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
        .where(eq(schema.images.id, item.imageId))
        .limit(1);

      if (imgData[0]) {
        topLikedImages.push({
          rank: i + 1,
          imageId: imgData[0].img.id,
          title: imgData[0].img.title,
          albumTitle: imgData[0].album?.title || "Album",
          festivalName: imgData[0].festival?.name,
          year: imgData[0].album?.year,
          url: imgData[0].img.url,
          thumbnailUrl: imgData[0].img.thumbnailUrl || imgData[0].img.url,
          likesCount: Number(item.count),
        });
      }
    }

    // 5. Top Favorited Albums
    const topFavAlbumsRaw = await db
      .select({
        albumId: schema.favorites.resourceId,
        count: sql<number>`count(*)`.as("favs_count"),
      })
      .from(schema.favorites)
      .where(eq(schema.favorites.resourceType, "album"))
      .groupBy(schema.favorites.resourceId)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    const topFavoritedAlbums = [];
    for (let i = 0; i < topFavAlbumsRaw.length; i++) {
      const item = topFavAlbumsRaw[i];
      if (!item) continue;
      if (!item.albumId) continue;
      const alb = await db
        .select({
          album: schema.albums,
          festival: schema.festivals,
        })
        .from(schema.albums)
        .leftJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
        .where(eq(schema.albums.id, item.albumId))
        .limit(1);

      if (alb[0]) {
        topFavoritedAlbums.push({
          rank: i + 1,
          albumId: alb[0].album.id,
          title: alb[0].album.title,
          festivalName: alb[0].festival?.name || "ពិធីបុណ្យ",
          festivalEmoji: alb[0].festival?.emoji || "🏮",
          year: alb[0].album.year,
          coverImage: alb[0].album.coverImage || undefined,
          favoritesCount: Number(item.count),
        });
      }
    }

    // 6. Top Favorited Images
    const topFavImagesRaw = await db
      .select({
        imageId:
          sql<string>`COALESCE(${schema.favorites.resourceId}, ${schema.favorites.imageId})`.as(
            "target_id",
          ),
        count: sql<number>`count(*)`.as("favs_count"),
      })
      .from(schema.favorites)
      .where(
        or(
          eq(schema.favorites.resourceType, "image"),
          sql`${schema.favorites.imageId} IS NOT NULL`,
        ),
      )
      .groupBy(sql`COALESCE(${schema.favorites.resourceId}, ${schema.favorites.imageId})`)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    const topFavoritedImages = [];
    for (let i = 0; i < topFavImagesRaw.length; i++) {
      const item = topFavImagesRaw[i];
      if (!item) continue;
      if (!item.imageId) continue;
      const imgData = await db
        .select({
          img: schema.images,
          album: schema.albums,
          festival: schema.festivals,
        })
        .from(schema.images)
        .leftJoin(schema.albums, eq(schema.images.albumId, schema.albums.id))
        .leftJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
        .where(eq(schema.images.id, item.imageId))
        .limit(1);

      if (imgData[0]) {
        topFavoritedImages.push({
          rank: i + 1,
          imageId: imgData[0].img.id,
          title: imgData[0].img.title,
          albumTitle: imgData[0].album?.title || "Album",
          festivalName: imgData[0].festival?.name,
          year: imgData[0].album?.year,
          url: imgData[0].img.url,
          thumbnailUrl: imgData[0].img.thumbnailUrl || imgData[0].img.url,
          favoritesCount: Number(item.count),
        });
      }
    }

    return {
      likes: {
        total: Number(totalLikesRes[0]?.count || 0),
        today: Number(todayLikesRes[0]?.count || 0),
        thisWeek: Number(weekLikesRes[0]?.count || 0),
        thisMonth: Number(monthLikesRes[0]?.count || 0),
      },
      favorites: {
        total: Number(totalFavRes[0]?.count || 0),
        today: Number(todayFavRes[0]?.count || 0),
        thisWeek: Number(weekFavRes[0]?.count || 0),
        thisMonth: Number(monthFavRes[0]?.count || 0),
      },
      topLikedAlbums,
      topLikedImages,
      topFavoritedAlbums,
      topFavoritedImages,
    };
  } catch (err) {
    console.warn("[getPostgresInteractionsAnalytics Error]:", err);
    return emptyRes;
  }
}

// =========================================================================
// --- PHASE 3.3 SEARCH ANALYTICS & POPULARITY INTELLIGENCE ---
// =========================================================================

export interface SearchAnalyticsSummary {
  totalSearches: number;
  uniqueQueries: number;
  zeroResultSearches: number;
  zeroResultRate: number;
  totalClicks: number;
  clickThroughRate: number;
  avgResultsCount: number;
}

export interface SearchDailyTrendPoint {
  date: string;
  label: string;
  searches: number;
  zeroResults: number;
  clicks: number;
}

export interface TopSearchQueryItem {
  query: string;
  normalizedQuery: string;
  searchCount: number;
  avgResults: number;
  clickCount: number;
  ctrPercent: number;
  lastSearchedAt: string;
}

export interface ZeroResultQueryItem {
  query: string;
  normalizedQuery: string;
  searchCount: number;
  lastSearchedAt: string;
  suggestedAction: string;
}

export interface RecentSearchItem {
  id: number;
  query: string;
  resultsCount: number;
  visitorId?: string | null | undefined;
  selectedResultId?: string | null | undefined;
  selectedResultType?: string | null | undefined;
  createdAt: string;
}

export interface SearchAnalyticsData {
  summary: SearchAnalyticsSummary;
  dailyTrend: SearchDailyTrendPoint[];
  topQueries: TopSearchQueryItem[];
  zeroResultQueries: ZeroResultQueryItem[];
  recentSearches: RecentSearchItem[];
}

export interface PopularAlbumItem {
  rank: number;
  albumId: string;
  title: string;
  festivalName: string;
  festivalEmoji: string;
  year: number;
  coverImage?: string | null | undefined;
  viewsCount: number;
  likesCount: number;
  favoritesCount: number;
  searchClicksCount: number;
  popularityScore: number;
}

export interface PopularImageItem {
  rank: number;
  imageId: string;
  title: string;
  albumTitle: string;
  festivalName?: string | null | undefined;
  year?: number | null | undefined;
  url: string;
  thumbnailUrl?: string | null | undefined;
  viewsCount: number;
  likesCount: number;
  favoritesCount: number;
  searchClicksCount: number;
  popularityScore: number;
}

export interface PopularFestivalItem {
  rank: number;
  festivalId: string;
  name: string;
  emoji: string;
  accent: string;
  month: string;
  albumsCount: number;
  totalViews: number;
  totalLikes: number;
  totalFavorites: number;
  searchClicksCount: number;
  popularityScore: number;
}

export interface PopularityIntelligenceData {
  weights: {
    views: number;
    likes: number;
    favorites: number;
    searchClicks: number;
  };
  topAlbums: PopularAlbumItem[];
  topImages: PopularImageItem[];
  topFestivals: PopularFestivalItem[];
}

/**
 * Record a public search event asynchronously in PostgreSQL
 */
export async function recordPostgresSearchLog(params: {
  query: string;
  resultsCount: number;
  visitorId?: string | undefined;
  userId?: string | undefined;
  selectedResultId?: string | undefined;
  selectedResultType?: string | undefined;
}): Promise<{ id: number; logged: boolean }> {
  const db = getDrizzleDb();
  const trimmed = params.query.trim();
  if (!trimmed) return { id: 0, logged: false };

  const normalized = normalizeSearchQuery(trimmed);

  if (!db || !isPostgresConfigured()) {
    return { id: Math.floor(Math.random() * 10000) + 1, logged: true };
  }

  try {
    const inserted = await db
      .insert(schema.searchLogs)
      .values({
        query: trimmed,
        normalizedQuery: normalized || trimmed.toLowerCase(),
        resultsCount: Math.max(0, params.resultsCount || 0),
        visitorId: params.visitorId || null,
        userId: params.userId || null,
        selectedResultId: params.selectedResultId || null,
        selectedResultType: params.selectedResultType || null,
        createdAt: new Date(),
      })
      .returning({ id: schema.searchLogs.id });

    return { id: inserted[0]?.id || 1, logged: true };
  } catch (err) {
    console.warn("[recordPostgresSearchLog Error]:", err);
    return { id: 0, logged: false };
  }
}

/**
 * Record a search click event (when user selects/opens a result from search results)
 */
export async function recordPostgresSearchClick(params: {
  logId?: number | undefined;
  query?: string | undefined;
  visitorId?: string | undefined;
  userId?: string | undefined;
  selectedResultId: string;
  selectedResultType: "album" | "image" | "festival";
}): Promise<{ recorded: boolean }> {
  const db = getDrizzleDb();
  if (!params.selectedResultId) return { recorded: false };

  if (!db || !isPostgresConfigured()) {
    return { recorded: true };
  }

  try {
    // If we have a specific search log ID, update it
    if (params.logId && params.logId > 0) {
      await db
        .update(schema.searchLogs)
        .set({
          selectedResultId: params.selectedResultId,
          selectedResultType: params.selectedResultType,
        })
        .where(eq(schema.searchLogs.id, params.logId));
      return { recorded: true };
    }

    // Otherwise find the most recent matching search log for this visitor/query
    if (params.visitorId || params.query) {
      const normalized = params.query ? normalizeSearchQuery(params.query) : undefined;
      const conditions = [];
      if (params.visitorId) conditions.push(eq(schema.searchLogs.visitorId, params.visitorId));
      if (normalized) conditions.push(eq(schema.searchLogs.normalizedQuery, normalized));

      const recentLog = await db
        .select({ id: schema.searchLogs.id })
        .from(schema.searchLogs)
        .where(and(...conditions, sql`${schema.searchLogs.selectedResultId} IS NULL`))
        .orderBy(desc(schema.searchLogs.createdAt))
        .limit(1);

      if (recentLog && recentLog[0]) {
        await db
          .update(schema.searchLogs)
          .set({
            selectedResultId: params.selectedResultId,
            selectedResultType: params.selectedResultType,
          })
          .where(eq(schema.searchLogs.id, recentLog[0].id));
        return { recorded: true };
      }
    }

    // If no recent log to attach to, insert a dedicated click log
    const queryStr = params.query?.trim() || "";
    await db.insert(schema.searchLogs).values({
      query: queryStr || "(direct click)",
      normalizedQuery: queryStr ? normalizeSearchQuery(queryStr) : "(direct click)",
      resultsCount: 1,
      visitorId: params.visitorId || null,
      userId: params.userId || null,
      selectedResultId: params.selectedResultId,
      selectedResultType: params.selectedResultType,
      createdAt: new Date(),
    });

    return { recorded: true };
  } catch (err) {
    console.warn("[recordPostgresSearchClick Error]:", err);
    return { recorded: false };
  }
}

/**
 * Get Search Analytics for Admin Dashboard
 */
export async function getPostgresSearchAnalytics(
  period: "today" | "7d" | "30d" | "all" = "7d",
): Promise<SearchAnalyticsData> {
  const db = getDrizzleDb();
  const emptyRes: SearchAnalyticsData = {
    summary: {
      totalSearches: 0,
      uniqueQueries: 0,
      zeroResultSearches: 0,
      zeroResultRate: 0,
      totalClicks: 0,
      clickThroughRate: 0,
      avgResultsCount: 0,
    },
    dailyTrend: [],
    topQueries: [],
    zeroResultQueries: [],
    recentSearches: [],
  };

  if (!db || !isPostgresConfigured()) {
    return emptyRes;
  }

  try {
    const { startDate, daysCount } = getPhnomPenhDateBounds(period);
    const dateCondition =
      period === "all" ? undefined : gte(schema.searchLogs.createdAt, startDate);

    // 1. Overview counts
    const searchLogsQuery = db.select().from(schema.searchLogs);
    const rows = dateCondition
      ? await searchLogsQuery.where(dateCondition).orderBy(desc(schema.searchLogs.createdAt))
      : await searchLogsQuery.orderBy(desc(schema.searchLogs.createdAt));

    const totalSearches = rows.length;
    const uniqueQueriesSet = new Set(rows.map((r) => r.normalizedQuery || r.query.toLowerCase()));
    const zeroResultsRows = rows.filter((r) => r.resultsCount === 0);
    const zeroResultSearches = zeroResultsRows.length;
    const clicksRows = rows.filter((r) => Boolean(r.selectedResultId));
    const totalClicks = clicksRows.length;

    const zeroResultRate =
      totalSearches > 0 ? Number(((zeroResultSearches / totalSearches) * 100).toFixed(1)) : 0;
    const clickThroughRate =
      totalSearches > 0 ? Number(((totalClicks / totalSearches) * 100).toFixed(1)) : 0;
    const avgResultsCount =
      totalSearches > 0
        ? Number(
            (rows.reduce((sum, r) => sum + (r.resultsCount || 0), 0) / totalSearches).toFixed(1),
          )
        : 0;

    // 2. Daily Trend
    const dailyMap = new Map<string, { searches: number; zeroResults: number; clicks: number }>();
    const now = new Date();
    const nowPP = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Phnom_Penh" }));

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(nowPP);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0]!;
      if (dateStr) {
        dailyMap.set(dateStr, { searches: 0, zeroResults: 0, clicks: 0 });
      }
    }

    for (const r of rows) {
      const rowPP = new Date(r.createdAt.toLocaleString("en-US", { timeZone: "Asia/Phnom_Penh" }));
      const dStr = rowPP.toISOString().split("T")[0]!;
      if (dStr) {
        const entry = dailyMap.get(dStr);
        if (entry) {
          entry.searches += 1;
          if (r.resultsCount === 0) entry.zeroResults += 1;
          if (r.selectedResultId) entry.clicks += 1;
        }
      }
    }

    const dailyTrend: SearchDailyTrendPoint[] = Array.from(dailyMap.entries()).map(
      ([date, counts]) => {
        const [, m, day] = date.split("-");
        return {
          date,
          label: `${day}/${m}`,
          searches: counts.searches,
          zeroResults: counts.zeroResults,
          clicks: counts.clicks,
        };
      },
    );

    // 3. Top Queries aggregation
    const queryMap = new Map<
      string,
      {
        displayQuery: string;
        count: number;
        totalResults: number;
        clicks: number;
        lastSearchedAt: Date;
      }
    >();

    for (const r of rows) {
      const normKey = r.normalizedQuery || r.query.trim().toLowerCase();
      if (!normKey) continue;
      const existing = queryMap.get(normKey);
      if (!existing) {
        queryMap.set(normKey, {
          displayQuery: r.query,
          count: 1,
          totalResults: r.resultsCount || 0,
          clicks: r.selectedResultId ? 1 : 0,
          lastSearchedAt: r.createdAt,
        });
      } else {
        existing.count += 1;
        existing.totalResults += r.resultsCount || 0;
        if (r.selectedResultId) existing.clicks += 1;
        if (r.createdAt > existing.lastSearchedAt) {
          existing.lastSearchedAt = r.createdAt;
          existing.displayQuery = r.query;
        }
      }
    }

    const topQueries: TopSearchQueryItem[] = Array.from(queryMap.entries())
      .map(([norm, val]) => ({
        query: val.displayQuery,
        normalizedQuery: norm,
        searchCount: val.count,
        avgResults: Number((val.totalResults / val.count).toFixed(1)),
        clickCount: val.clicks,
        ctrPercent: Number(((val.clicks / val.count) * 100).toFixed(1)),
        lastSearchedAt: val.lastSearchedAt.toISOString(),
      }))
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, 15);

    // 4. Zero-Result Queries (Missed Searches)
    const zeroResultMap = new Map<
      string,
      { displayQuery: string; count: number; lastSearchedAt: Date }
    >();

    for (const r of zeroResultsRows) {
      const normKey = r.normalizedQuery || r.query.trim().toLowerCase();
      if (!normKey) continue;
      const existing = zeroResultMap.get(normKey);
      if (!existing) {
        zeroResultMap.set(normKey, {
          displayQuery: r.query,
          count: 1,
          lastSearchedAt: r.createdAt,
        });
      } else {
        existing.count += 1;
        if (r.createdAt > existing.lastSearchedAt) {
          existing.lastSearchedAt = r.createdAt;
          existing.displayQuery = r.query;
        }
      }
    }

    const zeroResultQueries: ZeroResultQueryItem[] = Array.from(zeroResultMap.entries())
      .map(([norm, val]) => {
        let suggestedAction = "ពិនិត្យបន្ថែម Tags ឬ ពាក្យគន្លឹះ";
        if (norm.match(/^(២០|19|20)\d\d/)) {
          suggestedAction = "ពិនិត្យមើលថាតើមាន Album សម្រាប់ឆ្នាំនេះឬនៅ";
        } else if (norm.length <= 3) {
          suggestedAction = "ពាក្យខ្លីពេក — ណែនាំពាក្យពេញលេញ";
        } else if (val.count >= 3) {
          suggestedAction = "តម្រូវការខ្ពស់ — គួររៀបចំមាតិកា ឬ Album ថ្មី";
        }
        return {
          query: val.displayQuery,
          normalizedQuery: norm,
          searchCount: val.count,
          lastSearchedAt: val.lastSearchedAt.toISOString(),
          suggestedAction,
        };
      })
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, 15);

    // 5. Recent search activity stream
    const recentSearches: RecentSearchItem[] = rows.slice(0, 20).map((r) => ({
      id: r.id,
      query: r.query,
      resultsCount: r.resultsCount,
      visitorId: r.visitorId,
      selectedResultId: r.selectedResultId,
      selectedResultType: r.selectedResultType,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      summary: {
        totalSearches,
        uniqueQueries: uniqueQueriesSet.size,
        zeroResultSearches,
        zeroResultRate,
        totalClicks,
        clickThroughRate,
        avgResultsCount,
      },
      dailyTrend,
      topQueries,
      zeroResultQueries,
      recentSearches,
    };
  } catch (err) {
    console.warn("[getPostgresSearchAnalytics Error]:", err);
    return emptyRes;
  }
}

/**
 * Popularity Intelligence Engine
 * Computes multi-factor popularity ranking based on weighted formula:
 * Score = (Views × 1) + (Likes × 5) + (Favorites × 8) + (Search Clicks × 3)
 */
export async function getPostgresPopularityIntelligence(
  period: "today" | "7d" | "30d" | "all" = "all",
): Promise<PopularityIntelligenceData> {
  const db = getDrizzleDb();
  const emptyRes: PopularityIntelligenceData = {
    weights: { views: 1, likes: 5, favorites: 8, searchClicks: 3 },
    topAlbums: [],
    topImages: [],
    topFestivals: [],
  };

  if (!db || !isPostgresConfigured()) {
    return emptyRes;
  }

  try {
    const { startDate } = getPhnomPenhDateBounds(period);
    const dateCondition = period === "all" ? undefined : gte(schema.viewsLog.createdAt, startDate);
    const likeDateCondition = period === "all" ? undefined : gte(schema.likes.createdAt, startDate);
    const favDateCondition =
      period === "all" ? undefined : gte(schema.favorites.createdAt, startDate);
    const searchDateCondition =
      period === "all" ? undefined : gte(schema.searchLogs.createdAt, startDate);

    // 1. Fetch search clicks by resource
    const searchClicksByResourceQuery = db
      .select({
        resourceId: schema.searchLogs.selectedResultId,
        resourceType: schema.searchLogs.selectedResultType,
        clicks: sql<number>`count(*)`.as("clicks_count"),
      })
      .from(schema.searchLogs)
      .where(
        and(
          sql`${schema.searchLogs.selectedResultId} IS NOT NULL`,
          searchDateCondition ? searchDateCondition : sql`true`,
        ),
      )
      .groupBy(schema.searchLogs.selectedResultId, schema.searchLogs.selectedResultType);

    const searchClicksRaw = await searchClicksByResourceQuery;
    const albumSearchClicksMap = new Map<string, number>();
    const imageSearchClicksMap = new Map<string, number>();

    for (const sc of searchClicksRaw) {
      if (!sc.resourceId) continue;
      const count = Number(sc.clicks || 0);
      if (sc.resourceType === "image") {
        imageSearchClicksMap.set(sc.resourceId, count);
      } else {
        albumSearchClicksMap.set(sc.resourceId, count);
      }
    }

    // 2. Fetch all published albums
    const allAlbumsRaw = await db
      .select({
        album: schema.albums,
        festival: schema.festivals,
      })
      .from(schema.albums)
      .leftJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
      .where(sql`${schema.albums.status} != 'trashed'`);

    // Views by album
    const albumViewsMap = new Map<string, number>();
    const albumViewsQuery = db
      .select({
        resourceId: schema.viewsLog.resourceId,
        views: sql<number>`count(*)`.as("views_count"),
      })
      .from(schema.viewsLog)
      .where(
        and(eq(schema.viewsLog.resourceType, "album"), dateCondition ? dateCondition : sql`true`),
      )
      .groupBy(schema.viewsLog.resourceId);

    const albumViewsRaw = await albumViewsQuery;
    for (const v of albumViewsRaw) {
      albumViewsMap.set(v.resourceId, Number(v.views || 0));
    }

    // Likes by album
    const albumLikesMap = new Map<string, number>();
    const albumLikesQuery = db
      .select({
        resourceId: schema.likes.resourceId,
        likes: sql<number>`count(*)`.as("likes_count"),
      })
      .from(schema.likes)
      .where(
        and(
          eq(schema.likes.resourceType, "album"),
          likeDateCondition ? likeDateCondition : sql`true`,
        ),
      )
      .groupBy(schema.likes.resourceId);

    const albumLikesRaw = await albumLikesQuery;
    for (const l of albumLikesRaw) {
      albumLikesMap.set(l.resourceId, Number(l.likes || 0));
    }

    // Favorites by album
    const albumFavsMap = new Map<string, number>();
    const albumFavsQuery = db
      .select({
        resourceId: schema.favorites.resourceId,
        favs: sql<number>`count(*)`.as("favs_count"),
      })
      .from(schema.favorites)
      .where(
        and(
          eq(schema.favorites.resourceType, "album"),
          favDateCondition ? favDateCondition : sql`true`,
        ),
      )
      .groupBy(schema.favorites.resourceId);

    const albumFavsRaw = await albumFavsQuery;
    for (const f of albumFavsRaw) {
      if (f.resourceId) albumFavsMap.set(f.resourceId, Number(f.favs || 0));
    }

    // Compute popularity score for each album: (Views * 1) + (Likes * 5) + (Favs * 8) + (Clicks * 3)
    const albumScores: PopularAlbumItem[] = allAlbumsRaw.map(({ album, festival }) => {
      const views = albumViewsMap.get(album.id) ?? (period === "all" ? album.viewsCount || 0 : 0);
      const likes = albumLikesMap.get(album.id) ?? (period === "all" ? album.likesCount || 0 : 0);
      const favorites = albumFavsMap.get(album.id) || 0;
      const searchClicks = albumSearchClicksMap.get(album.id) || 0;

      const popularityScore = views * 1 + likes * 5 + favorites * 8 + searchClicks * 3;

      return {
        rank: 0,
        albumId: album.id,
        title: album.title,
        festivalName: festival?.name || "ពិធីបុណ្យ",
        festivalEmoji: festival?.emoji || "🏮",
        year: album.year,
        coverImage: album.coverImage || undefined,
        viewsCount: views,
        likesCount: likes,
        favoritesCount: favorites,
        searchClicksCount: searchClicks,
        popularityScore,
      };
    });

    albumScores.sort((a, b) => b.popularityScore - a.popularityScore);
    const topAlbums = albumScores.slice(0, 10).map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

    // 3. Compute Popular Images
    const allImagesRaw = await db
      .select({
        img: schema.images,
        album: schema.albums,
        festival: schema.festivals,
      })
      .from(schema.images)
      .leftJoin(schema.albums, eq(schema.images.albumId, schema.albums.id))
      .leftJoin(schema.festivals, eq(schema.albums.festivalId, schema.festivals.id))
      .where(and(eq(schema.images.status, "published"), sql`${schema.images.deletedAt} IS NULL`))
      .limit(300);

    // Views by image
    const imageViewsMap = new Map<string, number>();
    const imageViewsQuery = db
      .select({
        resourceId: schema.viewsLog.resourceId,
        views: sql<number>`count(*)`.as("views_count"),
      })
      .from(schema.viewsLog)
      .where(
        and(eq(schema.viewsLog.resourceType, "image"), dateCondition ? dateCondition : sql`true`),
      )
      .groupBy(schema.viewsLog.resourceId);

    const imageViewsRaw = await imageViewsQuery;
    for (const v of imageViewsRaw) {
      imageViewsMap.set(v.resourceId, Number(v.views || 0));
    }

    // Likes by image
    const imageLikesMap = new Map<string, number>();
    const imageLikesQuery = db
      .select({
        resourceId: schema.likes.resourceId,
        likes: sql<number>`count(*)`.as("likes_count"),
      })
      .from(schema.likes)
      .where(
        and(
          eq(schema.likes.resourceType, "image"),
          likeDateCondition ? likeDateCondition : sql`true`,
        ),
      )
      .groupBy(schema.likes.resourceId);

    const imageLikesRaw = await imageLikesQuery;
    for (const l of imageLikesRaw) {
      imageLikesMap.set(l.resourceId, Number(l.likes || 0));
    }

    // Favorites by image
    const imageFavsMap = new Map<string, number>();
    const imageFavsQuery = db
      .select({
        targetId:
          sql<string>`COALESCE(${schema.favorites.resourceId}, ${schema.favorites.imageId})`.as(
            "target_id",
          ),
        favs: sql<number>`count(*)`.as("favs_count"),
      })
      .from(schema.favorites)
      .where(
        and(
          or(
            eq(schema.favorites.resourceType, "image"),
            sql`${schema.favorites.imageId} IS NOT NULL`,
          ),
          favDateCondition ? favDateCondition : sql`true`,
        ),
      )
      .groupBy(sql`COALESCE(${schema.favorites.resourceId}, ${schema.favorites.imageId})`);

    const imageFavsRaw = await imageFavsQuery;
    for (const f of imageFavsRaw) {
      if (f.targetId) imageFavsMap.set(f.targetId, Number(f.favs || 0));
    }

    const imageScores: PopularImageItem[] = allImagesRaw.map(({ img, album, festival }) => {
      const views = imageViewsMap.get(img.id) ?? (period === "all" ? img.viewsCount || 0 : 0);
      const likes = imageLikesMap.get(img.id) ?? (period === "all" ? img.likesCount || 0 : 0);
      const favorites = imageFavsMap.get(img.id) || 0;
      const searchClicks = imageSearchClicksMap.get(img.id) || 0;

      const popularityScore = views * 1 + likes * 5 + favorites * 8 + searchClicks * 3;

      return {
        rank: 0,
        imageId: img.id,
        title: img.title,
        albumTitle: album?.title || "Album",
        festivalName: festival?.name,
        year: album?.year,
        url: img.url,
        thumbnailUrl: img.thumbnailUrl || img.url,
        viewsCount: views,
        likesCount: likes,
        favoritesCount: favorites,
        searchClicksCount: searchClicks,
        popularityScore,
      };
    });

    imageScores.sort((a, b) => b.popularityScore - a.popularityScore);
    const topImages = imageScores.slice(0, 10).map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

    // 4. Compute Popular Festivals
    const festivalsRaw = await db
      .select()
      .from(schema.festivals)
      .where(sql`${schema.festivals.status} != 'trashed'`);

    const festivalScores: PopularFestivalItem[] = festivalsRaw.map((fest) => {
      // Aggregate from albums belonging to this festival
      const festAlbums = albumScores.filter(
        (a) => allAlbumsRaw.find((raw) => raw.album.id === a.albumId)?.album.festivalId === fest.id,
      );

      const totalViews = festAlbums.reduce((sum, a) => sum + a.viewsCount, 0);
      const totalLikes = festAlbums.reduce((sum, a) => sum + a.likesCount, 0);
      const totalFavorites = festAlbums.reduce((sum, a) => sum + a.favoritesCount, 0);
      const searchClicksCount = festAlbums.reduce((sum, a) => sum + a.searchClicksCount, 0);

      const popularityScore =
        totalViews * 1 + totalLikes * 5 + totalFavorites * 8 + searchClicksCount * 3;

      return {
        rank: 0,
        festivalId: fest.id,
        name: fest.name,
        emoji: fest.emoji,
        accent: fest.accent,
        month: fest.month,
        albumsCount: festAlbums.length,
        totalViews,
        totalLikes,
        totalFavorites,
        searchClicksCount,
        popularityScore,
      };
    });

    festivalScores.sort((a, b) => b.popularityScore - a.popularityScore);
    const topFestivals = festivalScores.slice(0, 10).map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

    return {
      weights: { views: 1, likes: 5, favorites: 8, searchClicks: 3 },
      topAlbums,
      topImages,
      topFestivals,
    };
  } catch (err) {
    console.warn("[getPostgresPopularityIntelligence Error]:", err);
    return emptyRes;
  }
}

/**
 * Public trending search suggestions (top searched terms with results > 0)
 */
export async function getPostgresTrendingSearchSuggestions(
  limit: number = 8,
): Promise<Array<{ query: string; count: number }>> {
  const db = getDrizzleDb();
  const defaultSuggestions = [
    { query: "ភ្ជុំបិណ្ឌ", count: 42 },
    { query: "ចូលឆ្នាំថ្មី", count: 38 },
    { query: "កឋិនទាន", count: 29 },
    { query: "មាឃបូជា", count: 24 },
    { query: "វិសាខបូជា", count: 19 },
    { query: "២០២៤", count: 18 },
    { query: "ពុទ្ធាភិសេក", count: 15 },
    { query: "សាលាឆាន់", count: 12 },
  ];

  if (!db || !isPostgresConfigured()) {
    return defaultSuggestions.slice(0, limit);
  }

  try {
    const raw = await db
      .select({
        query: schema.searchLogs.query,
        count: sql<number>`count(*)`.as("search_count"),
      })
      .from(schema.searchLogs)
      .where(sql`${schema.searchLogs.resultsCount} > 0 AND ${schema.searchLogs.query} != ''`)
      .groupBy(schema.searchLogs.query)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    if (raw && raw.length > 0) {
      return raw.map((r) => ({
        query: r.query,
        count: Number(r.count || 0),
      }));
    }

    return defaultSuggestions.slice(0, limit);
  } catch (err) {
    console.warn("[getPostgresTrendingSearchSuggestions Error]:", err);
    return defaultSuggestions.slice(0, limit);
  }
}

// =========================================================================
// PHASE 3.4 — ADVANCED ADMIN DASHBOARD + REPORTS IMPLEMENTATION
// =========================================================================

export interface MetricComparison {
  current: number;
  previous: number;
  changePercent: number | null;
}

export interface ReportsSummaryData {
  period: string;
  startDate: string;
  endDate: string;
  previousPeriod?: {
    startDate: string;
    endDate: string;
  } | null;
  metrics: {
    totalVisitors: MetricComparison;
    uniqueVisitors: MetricComparison;
    pageViews: MetricComparison;
    albumViews: MetricComparison;
    imageViews: MetricComparison;
    totalViews: MetricComparison;
    likes: MetricComparison;
    favorites: MetricComparison;
    totalEngagement: MetricComparison;
    engagementRate: MetricComparison;
    searches: MetricComparison;
    uniqueQueries: MetricComparison;
    searchCtr: MetricComparison;
    zeroResultRate: MetricComparison;
    searchesPerVisitor: MetricComparison;
  };
}

function calcChangePercent(curr: number, prev: number): number | null {
  if (prev === 0) {
    return curr > 0 ? 100 : 0;
  }
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

/**
 * 1. Advanced Reports Summary & Comparative KPIs
 */
export async function getPostgresReportsSummary(
  period: ReportPeriod | string = "7d",
  customStartDate?: string | null,
  customEndDate?: string | null,
): Promise<ReportsSummaryData> {
  const currentBounds = getPhnomPenhDateBounds(period, customStartDate, customEndDate);
  const previousBounds = getPreviousPhnomPenhDateBounds(period, customStartDate, customEndDate);

  const defaultEmptyMetrics: ReportsSummaryData = {
    period,
    startDate: currentBounds.startDate.toISOString(),
    endDate: currentBounds.endDate.toISOString(),
    previousPeriod: previousBounds
      ? {
          startDate: previousBounds.startDate.toISOString(),
          endDate: previousBounds.endDate.toISOString(),
        }
      : null,
    metrics: {
      totalVisitors: { current: 0, previous: 0, changePercent: null },
      uniqueVisitors: { current: 0, previous: 0, changePercent: null },
      pageViews: { current: 0, previous: 0, changePercent: null },
      albumViews: { current: 0, previous: 0, changePercent: null },
      imageViews: { current: 0, previous: 0, changePercent: null },
      totalViews: { current: 0, previous: 0, changePercent: null },
      likes: { current: 0, previous: 0, changePercent: null },
      favorites: { current: 0, previous: 0, changePercent: null },
      totalEngagement: { current: 0, previous: 0, changePercent: null },
      engagementRate: { current: 0, previous: 0, changePercent: null },
      searches: { current: 0, previous: 0, changePercent: null },
      uniqueQueries: { current: 0, previous: 0, changePercent: null },
      searchCtr: { current: 0, previous: 0, changePercent: null },
      zeroResultRate: { current: 0, previous: 0, changePercent: null },
      searchesPerVisitor: { current: 0, previous: 0, changePercent: null },
    },
  };

  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return defaultEmptyMetrics;
  }

  try {
    const { startDate: cStart, endDate: cEnd } = currentBounds;

    // Current Period Aggregations
    const [
      cUniqueVisitorsRes,
      cPageViewsRes,
      cAlbumViewsRes,
      cImageViewsRes,
      cLikesRes,
      cFavoritesRes,
      cSearchesRes,
      cUniqueQueriesRes,
      cSearchClicksRes,
      cZeroResultsRes,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(distinct ${schema.viewsLog.visitorId})` })
        .from(schema.viewsLog)
        .where(
          period === "all"
            ? undefined
            : and(gte(schema.viewsLog.createdAt, cStart), lte(schema.viewsLog.createdAt, cEnd)),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.viewsLog)
        .where(
          and(
            eq(schema.viewsLog.resourceType, "page"),
            period === "all"
              ? undefined
              : and(gte(schema.viewsLog.createdAt, cStart), lte(schema.viewsLog.createdAt, cEnd)),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.viewsLog)
        .where(
          and(
            eq(schema.viewsLog.resourceType, "album"),
            period === "all"
              ? undefined
              : and(gte(schema.viewsLog.createdAt, cStart), lte(schema.viewsLog.createdAt, cEnd)),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.viewsLog)
        .where(
          and(
            eq(schema.viewsLog.resourceType, "image"),
            period === "all"
              ? undefined
              : and(gte(schema.viewsLog.createdAt, cStart), lte(schema.viewsLog.createdAt, cEnd)),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.likes)
        .where(
          period === "all"
            ? undefined
            : and(gte(schema.likes.createdAt, cStart), lte(schema.likes.createdAt, cEnd)),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.favorites)
        .where(
          period === "all"
            ? undefined
            : and(gte(schema.favorites.createdAt, cStart), lte(schema.favorites.createdAt, cEnd)),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.searchLogs)
        .where(
          period === "all"
            ? undefined
            : and(gte(schema.searchLogs.createdAt, cStart), lte(schema.searchLogs.createdAt, cEnd)),
        ),
      db
        .select({ count: sql<number>`count(distinct ${schema.searchLogs.normalizedQuery})` })
        .from(schema.searchLogs)
        .where(
          period === "all"
            ? undefined
            : and(gte(schema.searchLogs.createdAt, cStart), lte(schema.searchLogs.createdAt, cEnd)),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.searchLogs)
        .where(
          and(
            sql`${schema.searchLogs.selectedResultId} IS NOT NULL`,
            period === "all"
              ? undefined
              : and(
                  gte(schema.searchLogs.createdAt, cStart),
                  lte(schema.searchLogs.createdAt, cEnd),
                ),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.searchLogs)
        .where(
          and(
            eq(schema.searchLogs.resultsCount, 0),
            period === "all"
              ? undefined
              : and(
                  gte(schema.searchLogs.createdAt, cStart),
                  lte(schema.searchLogs.createdAt, cEnd),
                ),
          ),
        ),
    ]);

    const cUniqueVisitors = Number(cUniqueVisitorsRes[0]?.count || 0);
    const cPageViews = Number(cPageViewsRes[0]?.count || 0);
    const cAlbumViews = Number(cAlbumViewsRes[0]?.count || 0);
    const cImageViews = Number(cImageViewsRes[0]?.count || 0);
    const cTotalViews = cPageViews + cAlbumViews + cImageViews;
    const cLikes = Number(cLikesRes[0]?.count || 0);
    const cFavorites = Number(cFavoritesRes[0]?.count || 0);
    const cTotalEngagement = cLikes + cFavorites;
    const cEngagementRate =
      cPageViews > 0 ? Math.round((cTotalEngagement / cPageViews) * 1000) / 10 : 0;
    const cSearches = Number(cSearchesRes[0]?.count || 0);
    const cUniqueQueries = Number(cUniqueQueriesRes[0]?.count || 0);
    const cSearchClicks = Number(cSearchClicksRes[0]?.count || 0);
    const cZeroResults = Number(cZeroResultsRes[0]?.count || 0);
    const cSearchCtr = cSearches > 0 ? Math.round((cSearchClicks / cSearches) * 1000) / 10 : 0;
    const cZeroResultRate = cSearches > 0 ? Math.round((cZeroResults / cSearches) * 1000) / 10 : 0;
    const cSearchesPerVisitor =
      cUniqueVisitors > 0 ? Math.round((cSearches / cUniqueVisitors) * 10) / 10 : 0;

    // Previous Period Aggregations (if comparative period exists)
    let pUniqueVisitors = 0;
    let pPageViews = 0;
    let pAlbumViews = 0;
    let pImageViews = 0;
    let pTotalViews = 0;
    let pLikes = 0;
    let pFavorites = 0;
    let pTotalEngagement = 0;
    let pEngagementRate = 0;
    let pSearches = 0;
    let pUniqueQueries = 0;
    let pSearchClicks = 0;
    let pZeroResults = 0;
    let pSearchCtr = 0;
    let pZeroResultRate = 0;
    let pSearchesPerVisitor = 0;

    if (previousBounds) {
      const { startDate: pStart, endDate: pEnd } = previousBounds;
      const [
        pUniqueVisitorsRes,
        pPageViewsRes,
        pAlbumViewsRes,
        pImageViewsRes,
        pLikesRes,
        pFavoritesRes,
        pSearchesRes,
        pUniqueQueriesRes,
        pSearchClicksRes,
        pZeroResultsRes,
      ] = await Promise.all([
        db
          .select({ count: sql<number>`count(distinct ${schema.viewsLog.visitorId})` })
          .from(schema.viewsLog)
          .where(and(gte(schema.viewsLog.createdAt, pStart), lte(schema.viewsLog.createdAt, pEnd))),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.viewsLog)
          .where(
            and(
              eq(schema.viewsLog.resourceType, "page"),
              gte(schema.viewsLog.createdAt, pStart),
              lte(schema.viewsLog.createdAt, pEnd),
            ),
          ),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.viewsLog)
          .where(
            and(
              eq(schema.viewsLog.resourceType, "album"),
              gte(schema.viewsLog.createdAt, pStart),
              lte(schema.viewsLog.createdAt, pEnd),
            ),
          ),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.viewsLog)
          .where(
            and(
              eq(schema.viewsLog.resourceType, "image"),
              gte(schema.viewsLog.createdAt, pStart),
              lte(schema.viewsLog.createdAt, pEnd),
            ),
          ),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.likes)
          .where(and(gte(schema.likes.createdAt, pStart), lte(schema.likes.createdAt, pEnd))),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.favorites)
          .where(
            and(gte(schema.favorites.createdAt, pStart), lte(schema.favorites.createdAt, pEnd)),
          ),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.searchLogs)
          .where(
            and(gte(schema.searchLogs.createdAt, pStart), lte(schema.searchLogs.createdAt, pEnd)),
          ),
        db
          .select({ count: sql<number>`count(distinct ${schema.searchLogs.normalizedQuery})` })
          .from(schema.searchLogs)
          .where(
            and(gte(schema.searchLogs.createdAt, pStart), lte(schema.searchLogs.createdAt, pEnd)),
          ),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.searchLogs)
          .where(
            and(
              sql`${schema.searchLogs.selectedResultId} IS NOT NULL`,
              gte(schema.searchLogs.createdAt, pStart),
              lte(schema.searchLogs.createdAt, pEnd),
            ),
          ),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.searchLogs)
          .where(
            and(
              eq(schema.searchLogs.resultsCount, 0),
              gte(schema.searchLogs.createdAt, pStart),
              lte(schema.searchLogs.createdAt, pEnd),
            ),
          ),
      ]);

      pUniqueVisitors = Number(pUniqueVisitorsRes[0]?.count || 0);
      pPageViews = Number(pPageViewsRes[0]?.count || 0);
      pAlbumViews = Number(pAlbumViewsRes[0]?.count || 0);
      pImageViews = Number(pImageViewsRes[0]?.count || 0);
      pTotalViews = pPageViews + pAlbumViews + pImageViews;
      pLikes = Number(pLikesRes[0]?.count || 0);
      pFavorites = Number(pFavoritesRes[0]?.count || 0);
      pTotalEngagement = pLikes + pFavorites;
      pEngagementRate =
        pPageViews > 0 ? Math.round((pTotalEngagement / pPageViews) * 1000) / 10 : 0;
      pSearches = Number(pSearchesRes[0]?.count || 0);
      pUniqueQueries = Number(pUniqueQueriesRes[0]?.count || 0);
      pSearchClicks = Number(pSearchClicksRes[0]?.count || 0);
      pZeroResults = Number(pZeroResultsRes[0]?.count || 0);
      pSearchCtr = pSearches > 0 ? Math.round((pSearchClicks / pSearches) * 1000) / 10 : 0;
      pZeroResultRate = pSearches > 0 ? Math.round((pZeroResults / pSearches) * 1000) / 10 : 0;
      pSearchesPerVisitor =
        pUniqueVisitors > 0 ? Math.round((pSearches / pUniqueVisitors) * 10) / 10 : 0;
    }

    return {
      period,
      startDate: cStart.toISOString(),
      endDate: cEnd.toISOString(),
      previousPeriod: previousBounds
        ? {
            startDate: previousBounds.startDate.toISOString(),
            endDate: previousBounds.endDate.toISOString(),
          }
        : null,
      metrics: {
        totalVisitors: {
          current: cUniqueVisitors,
          previous: pUniqueVisitors,
          changePercent: previousBounds
            ? calcChangePercent(cUniqueVisitors, pUniqueVisitors)
            : null,
        },
        uniqueVisitors: {
          current: cUniqueVisitors,
          previous: pUniqueVisitors,
          changePercent: previousBounds
            ? calcChangePercent(cUniqueVisitors, pUniqueVisitors)
            : null,
        },
        pageViews: {
          current: cPageViews,
          previous: pPageViews,
          changePercent: previousBounds ? calcChangePercent(cPageViews, pPageViews) : null,
        },
        albumViews: {
          current: cAlbumViews,
          previous: pAlbumViews,
          changePercent: previousBounds ? calcChangePercent(cAlbumViews, pAlbumViews) : null,
        },
        imageViews: {
          current: cImageViews,
          previous: pImageViews,
          changePercent: previousBounds ? calcChangePercent(cImageViews, pImageViews) : null,
        },
        totalViews: {
          current: cTotalViews,
          previous: pTotalViews,
          changePercent: previousBounds ? calcChangePercent(cTotalViews, pTotalViews) : null,
        },
        likes: {
          current: cLikes,
          previous: pLikes,
          changePercent: previousBounds ? calcChangePercent(cLikes, pLikes) : null,
        },
        favorites: {
          current: cFavorites,
          previous: pFavorites,
          changePercent: previousBounds ? calcChangePercent(cFavorites, pFavorites) : null,
        },
        totalEngagement: {
          current: cTotalEngagement,
          previous: pTotalEngagement,
          changePercent: previousBounds
            ? calcChangePercent(cTotalEngagement, pTotalEngagement)
            : null,
        },
        engagementRate: {
          current: cEngagementRate,
          previous: pEngagementRate,
          changePercent: previousBounds
            ? calcChangePercent(cEngagementRate, pEngagementRate)
            : null,
        },
        searches: {
          current: cSearches,
          previous: pSearches,
          changePercent: previousBounds ? calcChangePercent(cSearches, pSearches) : null,
        },
        uniqueQueries: {
          current: cUniqueQueries,
          previous: pUniqueQueries,
          changePercent: previousBounds ? calcChangePercent(cUniqueQueries, pUniqueQueries) : null,
        },
        searchCtr: {
          current: cSearchCtr,
          previous: pSearchCtr,
          changePercent: previousBounds ? calcChangePercent(cSearchCtr, pSearchCtr) : null,
        },
        zeroResultRate: {
          current: cZeroResultRate,
          previous: pZeroResultRate,
          changePercent: previousBounds
            ? calcChangePercent(cZeroResultRate, pZeroResultRate)
            : null,
        },
        searchesPerVisitor: {
          current: cSearchesPerVisitor,
          previous: pSearchesPerVisitor,
          changePercent: previousBounds
            ? calcChangePercent(cSearchesPerVisitor, pSearchesPerVisitor)
            : null,
        },
      },
    };
  } catch (err) {
    console.warn("[getPostgresReportsSummary Error]:", err);
    return defaultEmptyMetrics;
  }
}

export interface ContentPerformanceFestivalItem {
  festivalId: string;
  name: string;
  emoji: string;
  accent: string;
  month: string;
  albumsCount: number;
  imagesCount: number;
  totalViews: number;
  totalLikes: number;
  totalFavorites: number;
  searchClicksCount: number;
  popularityScore: number;
}

export interface ContentPerformanceYearItem {
  year: number;
  albumsCount: number;
  imagesCount: number;
  totalViews: number;
  totalLikes: number;
  totalFavorites: number;
  totalEngagement: number;
  popularityScore: number;
}

export interface ContentPerformanceAlbumItem {
  albumId: string;
  title: string;
  festivalId: string;
  festivalName: string;
  festivalEmoji: string;
  year: number;
  photoCount: number;
  coverImage?: string | null | undefined;
  viewsCount: number;
  likesCount: number;
  favoritesCount: number;
  searchClicksCount: number;
  popularityScore: number;
  createdAt?: string | undefined;
}

export interface ContentPerformanceReportData {
  period: string;
  festivals: ContentPerformanceFestivalItem[];
  years: ContentPerformanceYearItem[];
  albums: ContentPerformanceAlbumItem[];
  totals: {
    festivalsCount: number;
    yearsCount: number;
    albumsCount: number;
    imagesCount: number;
    viewsCount: number;
    likesCount: number;
    favoritesCount: number;
    totalEngagement: number;
  };
}

/**
 * 2. Content Performance Report (Festivals, Years, and Albums performance)
 */
export async function getPostgresContentPerformance(
  period: ReportPeriod | string = "all",
  customStartDate?: string | null,
  customEndDate?: string | null,
  filterFestivalId?: string | null,
  filterYear?: number | null,
): Promise<ContentPerformanceReportData> {
  const { startDate, endDate } = getPhnomPenhDateBounds(period, customStartDate, customEndDate);
  const db = getDrizzleDb();

  const emptyResponse: ContentPerformanceReportData = {
    period,
    festivals: [],
    years: [],
    albums: [],
    totals: {
      festivalsCount: 0,
      yearsCount: 0,
      albumsCount: 0,
      imagesCount: 0,
      viewsCount: 0,
      likesCount: 0,
      favoritesCount: 0,
      totalEngagement: 0,
    },
  };

  if (!db || !isPostgresConfigured()) {
    return emptyResponse;
  }

  try {
    // 1. Fetch raw active entities
    const [allFestivals, allYears, allAlbums, allImages] = await Promise.all([
      db
        .select()
        .from(schema.festivals)
        .where(sql`${schema.festivals.status} != 'trashed'`),
      db.select({ year: schema.years.year }).from(schema.years).orderBy(desc(schema.years.year)),
      db
        .select()
        .from(schema.albums)
        .where(sql`${schema.albums.status} != 'trashed'`),
      db
        .select({
          id: schema.images.id,
          albumId: schema.images.albumId,
          viewsCount: schema.images.viewsCount,
          likesCount: schema.images.likesCount,
        })
        .from(schema.images)
        .where(sql`${schema.images.status} != 'trashed'`),
    ]);

    // 2. Fetch period views, likes, favorites, and search clicks
    const dateCondition =
      period === "all"
        ? undefined
        : and(gte(schema.viewsLog.createdAt, startDate), lte(schema.viewsLog.createdAt, endDate));
    const likesCondition =
      period === "all"
        ? undefined
        : and(gte(schema.likes.createdAt, startDate), lte(schema.likes.createdAt, endDate));
    const favsCondition =
      period === "all"
        ? undefined
        : and(gte(schema.favorites.createdAt, startDate), lte(schema.favorites.createdAt, endDate));
    const clicksCondition =
      period === "all"
        ? undefined
        : and(
            gte(schema.searchLogs.createdAt, startDate),
            lte(schema.searchLogs.createdAt, endDate),
          );

    const [albumViewsRaw, albumLikesRaw, albumFavsRaw, albumClicksRaw] = await Promise.all([
      db
        .select({
          targetId: schema.viewsLog.resourceId,
          views: sql<number>`count(*)`,
        })
        .from(schema.viewsLog)
        .where(and(eq(schema.viewsLog.resourceType, "album"), dateCondition))
        .groupBy(schema.viewsLog.resourceId),
      db
        .select({
          targetId: schema.likes.resourceId,
          likes: sql<number>`count(*)`,
        })
        .from(schema.likes)
        .where(and(eq(schema.likes.resourceType, "album"), likesCondition))
        .groupBy(schema.likes.resourceId),
      db
        .select({
          targetId: schema.favorites.resourceId,
          favs: sql<number>`count(*)`,
        })
        .from(schema.favorites)
        .where(and(eq(schema.favorites.resourceType, "album"), favsCondition))
        .groupBy(schema.favorites.resourceId),
      db
        .select({
          targetId: schema.searchLogs.selectedResultId,
          clicks: sql<number>`count(*)`,
        })
        .from(schema.searchLogs)
        .where(and(eq(schema.searchLogs.selectedResultType, "album"), clicksCondition))
        .groupBy(schema.searchLogs.selectedResultId),
    ]);

    const albumViewsMap = new Map<string, number>();
    for (const v of albumViewsRaw) {
      if (v.targetId) albumViewsMap.set(v.targetId, Number(v.views || 0));
    }
    const albumLikesMap = new Map<string, number>();
    for (const l of albumLikesRaw) {
      if (l.targetId) albumLikesMap.set(l.targetId, Number(l.likes || 0));
    }
    const albumFavsMap = new Map<string, number>();
    for (const f of albumFavsRaw) {
      if (f.targetId) albumFavsMap.set(f.targetId, Number(f.favs || 0));
    }
    const albumClicksMap = new Map<string, number>();
    for (const c of albumClicksRaw) {
      if (c.targetId) albumClicksMap.set(c.targetId, Number(c.clicks || 0));
    }

    // Images count per album
    const albumImageCountMap = new Map<string, number>();
    for (const img of allImages) {
      albumImageCountMap.set(img.albumId, (albumImageCountMap.get(img.albumId) || 0) + 1);
    }

    // Build Album Performance Items
    const festivalsMap = new Map(allFestivals.map((f) => [f.id, f]));

    let albumItems: ContentPerformanceAlbumItem[] = allAlbums.map((alb) => {
      const fest = festivalsMap.get(alb.festivalId);
      const views = albumViewsMap.get(alb.id) ?? (period === "all" ? alb.viewsCount || 0 : 0);
      const likes = albumLikesMap.get(alb.id) ?? (period === "all" ? alb.likesCount || 0 : 0);
      const favorites = albumFavsMap.get(alb.id) || 0;
      const searchClicks = albumClicksMap.get(alb.id) || 0;
      const photos = albumImageCountMap.get(alb.id) || alb.photoCount || 0;
      const popularityScore = views * 1 + likes * 5 + favorites * 8 + searchClicks * 3;

      return {
        albumId: alb.id,
        title: alb.title,
        festivalId: alb.festivalId,
        festivalName: fest?.name || "ពិធីបុណ្យ",
        festivalEmoji: fest?.emoji || "🏮",
        year: alb.year,
        photoCount: photos,
        coverImage: alb.coverImage,
        viewsCount: views,
        likesCount: likes,
        favoritesCount: favorites,
        searchClicksCount: searchClicks,
        popularityScore,
        createdAt: alb.createdAt ? alb.createdAt.toISOString() : undefined,
      };
    });

    if (filterFestivalId) {
      albumItems = albumItems.filter((a) => a.festivalId === filterFestivalId);
    }
    if (filterYear) {
      albumItems = albumItems.filter((a) => a.year === filterYear);
    }

    albumItems.sort((a, b) => b.popularityScore - a.popularityScore);

    // Build Festival Performance Items
    const festivalItems: ContentPerformanceFestivalItem[] = allFestivals.map((fest) => {
      const festAlbums = allAlbums.filter((a) => a.festivalId === fest.id);
      const festAlbumIds = new Set(festAlbums.map((a) => a.id));
      const imagesCount = allImages.filter((img) => festAlbumIds.has(img.albumId)).length;

      let totalViews = 0;
      let totalLikes = 0;
      let totalFavorites = 0;
      let searchClicksCount = 0;

      for (const albId of festAlbumIds) {
        const aViews =
          albumViewsMap.get(albId) ??
          (period === "all" ? allAlbums.find((a) => a.id === albId)?.viewsCount || 0 : 0);
        const aLikes =
          albumLikesMap.get(albId) ??
          (period === "all" ? allAlbums.find((a) => a.id === albId)?.likesCount || 0 : 0);
        totalViews += aViews;
        totalLikes += aLikes;
        totalFavorites += albumFavsMap.get(albId) || 0;
        searchClicksCount += albumClicksMap.get(albId) || 0;
      }

      const popularityScore =
        totalViews * 1 + totalLikes * 5 + totalFavorites * 8 + searchClicksCount * 3;

      return {
        festivalId: fest.id,
        name: fest.name,
        emoji: fest.emoji,
        accent: fest.accent,
        month: fest.month,
        albumsCount: festAlbums.length,
        imagesCount,
        totalViews,
        totalLikes,
        totalFavorites,
        searchClicksCount,
        popularityScore,
      };
    });

    festivalItems.sort((a, b) => b.popularityScore - a.popularityScore);

    // Build Year Performance Items
    const yearItems: ContentPerformanceYearItem[] = allYears.map(({ year }) => {
      const yearAlbums = allAlbums.filter((a) => a.year === year);
      const yearAlbumIds = new Set(yearAlbums.map((a) => a.id));
      const imagesCount = allImages.filter((img) => yearAlbumIds.has(img.albumId)).length;

      let totalViews = 0;
      let totalLikes = 0;
      let totalFavorites = 0;
      let searchClicksCount = 0;

      for (const albId of yearAlbumIds) {
        const aViews =
          albumViewsMap.get(albId) ??
          (period === "all" ? allAlbums.find((a) => a.id === albId)?.viewsCount || 0 : 0);
        const aLikes =
          albumLikesMap.get(albId) ??
          (period === "all" ? allAlbums.find((a) => a.id === albId)?.likesCount || 0 : 0);
        totalViews += aViews;
        totalLikes += aLikes;
        totalFavorites += albumFavsMap.get(albId) || 0;
        searchClicksCount += albumClicksMap.get(albId) || 0;
      }

      const totalEngagement = totalLikes + totalFavorites;
      const popularityScore =
        totalViews * 1 + totalLikes * 5 + totalFavorites * 8 + searchClicksCount * 3;

      return {
        year,
        albumsCount: yearAlbums.length,
        imagesCount,
        totalViews,
        totalLikes,
        totalFavorites,
        totalEngagement,
        popularityScore,
      };
    });

    yearItems.sort((a, b) => b.year - a.year);

    // Calculate totals
    const totalViews = albumItems.reduce((acc, a) => acc + a.viewsCount, 0);
    const totalLikes = albumItems.reduce((acc, a) => acc + a.likesCount, 0);
    const totalFavorites = albumItems.reduce((acc, a) => acc + a.favoritesCount, 0);

    return {
      period,
      festivals: festivalItems,
      years: yearItems,
      albums: albumItems,
      totals: {
        festivalsCount: allFestivals.length,
        yearsCount: allYears.length,
        albumsCount: allAlbums.length,
        imagesCount: allImages.length,
        viewsCount: totalViews,
        likesCount: totalLikes,
        favoritesCount: totalFavorites,
        totalEngagement: totalLikes + totalFavorites,
      },
    };
  } catch (err) {
    console.warn("[getPostgresContentPerformance Error]:", err);
    return emptyResponse;
  }
}

export interface ArchiveGrowthPoint {
  periodLabel: string;
  dateKey: string;
  newFestivals: number;
  newYears: number;
  newAlbums: number;
  newImages: number;
  cumulativeFestivals: number;
  cumulativeYears: number;
  cumulativeAlbums: number;
  cumulativeImages: number;
}

export interface ArchiveGrowthReportData {
  groupBy: "month" | "year";
  timeline: ArchiveGrowthPoint[];
  totals: {
    festivals: number;
    years: number;
    albums: number;
    images: number;
  };
}

/**
 * 3. Archive Content Growth Report (Timeline of new content added)
 */
export async function getPostgresArchiveGrowth(
  groupBy: "month" | "year" = "month",
): Promise<ArchiveGrowthReportData> {
  const db = getDrizzleDb();

  const emptyResponse: ArchiveGrowthReportData = {
    groupBy,
    timeline: [],
    totals: { festivals: 0, years: 0, albums: 0, images: 0 },
  };

  if (!db || !isPostgresConfigured()) {
    return emptyResponse;
  }

  try {
    const [allFestivals, allYears, allAlbums, allImages] = await Promise.all([
      db.select({ createdAt: schema.festivals.createdAt }).from(schema.festivals),
      db.select({ createdAt: schema.years.createdAt }).from(schema.years),
      db.select({ createdAt: schema.albums.createdAt }).from(schema.albums),
      db.select({ createdAt: schema.images.createdAt }).from(schema.images),
    ]);

    // Map by period key (e.g. YYYY-MM or YYYY)
    const timeBucketMap = new Map<
      string,
      { newFestivals: number; newYears: number; newAlbums: number; newImages: number }
    >();

    const getKey = (d?: Date | null) => {
      const date = d || new Date();
      const yr = date.getFullYear();
      if (groupBy === "year") return `${yr}`;
      const mo = String(date.getMonth() + 1).padStart(2, "0");
      return `${yr}-${mo}`;
    };

    for (const f of allFestivals) {
      const k = getKey(f.createdAt);
      const b = timeBucketMap.get(k) || {
        newFestivals: 0,
        newYears: 0,
        newAlbums: 0,
        newImages: 0,
      };
      b.newFestivals++;
      timeBucketMap.set(k, b);
    }

    for (const y of allYears) {
      const k = getKey(y.createdAt);
      const b = timeBucketMap.get(k) || {
        newFestivals: 0,
        newYears: 0,
        newAlbums: 0,
        newImages: 0,
      };
      b.newYears++;
      timeBucketMap.set(k, b);
    }

    for (const a of allAlbums) {
      const k = getKey(a.createdAt);
      const b = timeBucketMap.get(k) || {
        newFestivals: 0,
        newYears: 0,
        newAlbums: 0,
        newImages: 0,
      };
      b.newAlbums++;
      timeBucketMap.set(k, b);
    }

    for (const img of allImages) {
      const k = getKey(img.createdAt);
      const b = timeBucketMap.get(k) || {
        newFestivals: 0,
        newYears: 0,
        newAlbums: 0,
        newImages: 0,
      };
      b.newImages++;
      timeBucketMap.set(k, b);
    }

    // Sort sorted keys
    const sortedKeys = Array.from(timeBucketMap.keys()).sort();

    let cumFestivals = 0;
    let cumYears = 0;
    let cumAlbums = 0;
    let cumImages = 0;

    const timeline: ArchiveGrowthPoint[] = sortedKeys.map((k) => {
      const bucket = timeBucketMap.get(k)!;
      cumFestivals += bucket.newFestivals;
      cumYears += bucket.newYears;
      cumAlbums += bucket.newAlbums;
      cumImages += bucket.newImages;

      return {
        dateKey: k,
        periodLabel: groupBy === "year" ? `ឆ្នាំ ${k}` : `ខែ ${k.split("-")[1]}/${k.split("-")[0]}`,
        newFestivals: bucket.newFestivals,
        newYears: bucket.newYears,
        newAlbums: bucket.newAlbums,
        newImages: bucket.newImages,
        cumulativeFestivals: cumFestivals,
        cumulativeYears: cumYears,
        cumulativeAlbums: cumAlbums,
        cumulativeImages: cumImages,
      };
    });

    return {
      groupBy,
      timeline,
      totals: {
        festivals: allFestivals.length,
        years: allYears.length,
        albums: allAlbums.length,
        images: allImages.length,
      },
    };
  } catch (err) {
    console.warn("[getPostgresArchiveGrowth Error]:", err);
    return emptyResponse;
  }
}

export interface AdminActivitySummaryData {
  period: string;
  summary: {
    totalActions: number;
    logins: number;
    uploads: number;
    edits: number;
    deletes: number;
    restores: number;
    securityChanges: number;
    userManagement: number;
  };
  recentLogs: Array<{
    id: string;
    userId: string;
    userName: string;
    userRole: string;
    action: string;
    resource: string;
    resourceId?: string | null | undefined;
    details?: string | null | undefined;
    ip?: string | null | undefined;
    timestamp: string;
  }>;
  actorBreakdown: Array<{
    userName: string;
    userRole: string;
    actionsCount: number;
    lastActionAt: string;
  }>;
}

/**
 * 4. Admin Activity Summary & Audit Log Intelligence
 */
export async function getPostgresAdminActivitySummary(
  period: ReportPeriod | string = "30d",
  customStartDate?: string | null,
  customEndDate?: string | null,
): Promise<AdminActivitySummaryData> {
  const { startDate, endDate } = getPhnomPenhDateBounds(period, customStartDate, customEndDate);
  const db = getDrizzleDb();

  const emptyResponse: AdminActivitySummaryData = {
    period,
    summary: {
      totalActions: 0,
      logins: 0,
      uploads: 0,
      edits: 0,
      deletes: 0,
      restores: 0,
      securityChanges: 0,
      userManagement: 0,
    },
    recentLogs: [],
    actorBreakdown: [],
  };

  if (!db || !isPostgresConfigured()) {
    return emptyResponse;
  }

  try {
    const whereCondition =
      period === "all"
        ? undefined
        : and(
            gte(schema.activityLogs.timestamp, startDate),
            lte(schema.activityLogs.timestamp, endDate),
          );

    const logs = await db
      .select()
      .from(schema.activityLogs)
      .where(whereCondition)
      .orderBy(desc(schema.activityLogs.timestamp))
      .limit(200);

    let logins = 0;
    let uploads = 0;
    let edits = 0;
    let deletes = 0;
    let restores = 0;
    let securityChanges = 0;
    let userManagement = 0;

    const actorMap = new Map<
      string,
      { userName: string; userRole: string; count: number; lastAt: Date }
    >();

    for (const log of logs) {
      const act = (log.action || "").toUpperCase();
      const res = (log.resource || "").toUpperCase();

      if (act.includes("LOGIN")) logins++;
      else if (act.includes("UPLOAD") || act.includes("CREATE")) uploads++;
      else if (act.includes("EDIT") || act.includes("UPDATE")) edits++;
      else if (act.includes("DELETE") || act.includes("TRASH")) deletes++;
      else if (act.includes("RESTORE")) restores++;
      else if (act.includes("PASSWORD") || res.includes("AUTH")) securityChanges++;
      else if (res.includes("USER")) userManagement++;

      const actorKey = log.userName || log.userId || "Unknown";
      const existing = actorMap.get(actorKey);
      if (existing) {
        existing.count++;
        if (log.timestamp > existing.lastAt) existing.lastAt = log.timestamp;
      } else {
        actorMap.set(actorKey, {
          userName: log.userName,
          userRole: log.userRole,
          count: 1,
          lastAt: log.timestamp,
        });
      }
    }

    const actorBreakdown = Array.from(actorMap.values())
      .map((a) => ({
        userName: a.userName,
        userRole: a.userRole,
        actionsCount: a.count,
        lastActionAt: a.lastAt.toISOString(),
      }))
      .sort((a, b) => b.actionsCount - a.actionsCount);

    return {
      period,
      summary: {
        totalActions: logs.length,
        logins,
        uploads,
        edits,
        deletes,
        restores,
        securityChanges,
        userManagement,
      },
      recentLogs: logs.slice(0, 50).map((l) => ({
        id: l.id,
        userId: l.userId,
        userName: l.userName,
        userRole: l.userRole,
        action: l.action,
        resource: l.resource,
        resourceId: l.resourceId,
        details: l.details,
        ip: l.ip,
        timestamp: l.timestamp.toISOString(),
      })),
      actorBreakdown,
    };
  } catch (err) {
    console.warn("[getPostgresAdminActivitySummary Error]:", err);
    return emptyResponse;
  }
}

/**
 * 5. Report Export Generator (CSV with UTF-8 BOM & Structured JSON)
 */
export async function generatePostgresExportReport(
  format: "csv" | "json",
  reportType:
    | "all"
    | "summary"
    | "content-performance"
    | "top-albums"
    | "top-images"
    | "search-queries"
    | "growth"
    | "activity",
  period: ReportPeriod | string = "7d",
  customStartDate?: string | null,
  customEndDate?: string | null,
): Promise<{ content: string; mimeType: string; filename: string }> {
  const dateTag = new Date().toISOString().slice(0, 10);
  const cleanFilename = `wat_peareang_report_${reportType}_${period}_${dateTag}.${format}`;

  if (format === "json") {
    const payload: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      reportType,
      period,
    };

    const validPeriod = (["today", "7d", "30d", "all"].includes(period) ? period : "7d") as
      "today" | "7d" | "30d" | "all";

    if (reportType === "summary" || reportType === "all") {
      payload["summary"] = await getPostgresReportsSummary(period, customStartDate, customEndDate);
    }
    if (reportType === "content-performance" || reportType === "all") {
      payload["contentPerformance"] = await getPostgresContentPerformance(
        period,
        customStartDate,
        customEndDate,
      );
    }
    if (reportType === "top-albums" || reportType === "all") {
      payload["topAlbums"] = await getPostgresTopAlbums(validPeriod, 50);
    }
    if (reportType === "top-images" || reportType === "all") {
      payload["topImages"] = await getPostgresTopImages(validPeriod, 50);
    }
    if (reportType === "search-queries" || reportType === "all") {
      payload["searchAnalytics"] = await getPostgresSearchAnalytics(validPeriod);
    }
    if (reportType === "growth" || reportType === "all") {
      payload["growth"] = await getPostgresArchiveGrowth("month");
    }
    if (reportType === "activity" || reportType === "all") {
      payload["activity"] = await getPostgresAdminActivitySummary(
        period,
        customStartDate,
        customEndDate,
      );
    }

    return {
      content: JSON.stringify(payload, null, 2),
      mimeType: "application/json; charset=utf-8",
      filename: cleanFilename,
    };
  }

  // CSV Generator with UTF-8 BOM
  const BOM = "\uFEFF";
  const rows: string[][] = [];
  const validPeriod = (["today", "7d", "30d", "all"].includes(period) ? period : "7d") as
    "today" | "7d" | "30d" | "all";

  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  if (reportType === "summary") {
    const data = await getPostgresReportsSummary(period, customStartDate, customEndDate);
    rows.push(["Wat Peareang Digital Archive - Summary & KPI Report"]);
    rows.push(["Period", period, "From", data.startDate, "To", data.endDate]);
    rows.push([]);
    rows.push(["Metric Name", "Current Period", "Previous Period", "Change (%)"]);
    rows.push([
      "Total Visitors (អ្នកទស្សនា)",
      String(data.metrics.totalVisitors.current),
      String(data.metrics.totalVisitors.previous),
      data.metrics.totalVisitors.changePercent !== null
        ? `${data.metrics.totalVisitors.changePercent}%`
        : "-",
    ]);
    rows.push([
      "Page Views (ការបើកទំព័រ)",
      String(data.metrics.pageViews.current),
      String(data.metrics.pageViews.previous),
      data.metrics.pageViews.changePercent !== null
        ? `${data.metrics.pageViews.changePercent}%`
        : "-",
    ]);
    rows.push([
      "Album Views (ការមើល Albums)",
      String(data.metrics.albumViews.current),
      String(data.metrics.albumViews.previous),
      data.metrics.albumViews.changePercent !== null
        ? `${data.metrics.albumViews.changePercent}%`
        : "-",
    ]);
    rows.push([
      "Image Views (ការមើលរូបថត)",
      String(data.metrics.imageViews.current),
      String(data.metrics.imageViews.previous),
      data.metrics.imageViews.changePercent !== null
        ? `${data.metrics.imageViews.changePercent}%`
        : "-",
    ]);
    rows.push([
      "Total Views (ការមើលសរុប)",
      String(data.metrics.totalViews.current),
      String(data.metrics.totalViews.previous),
      data.metrics.totalViews.changePercent !== null
        ? `${data.metrics.totalViews.changePercent}%`
        : "-",
    ]);
    rows.push([
      "Likes (ចំនួនចូលចិត្ត)",
      String(data.metrics.likes.current),
      String(data.metrics.likes.previous),
      data.metrics.likes.changePercent !== null ? `${data.metrics.likes.changePercent}%` : "-",
    ]);
    rows.push([
      "Favorites (ចំនួនរក្សាទុក)",
      String(data.metrics.favorites.current),
      String(data.metrics.favorites.previous),
      data.metrics.favorites.changePercent !== null
        ? `${data.metrics.favorites.changePercent}%`
        : "-",
    ]);
    rows.push([
      "Total Engagement (អន្តរកម្មសរុប)",
      String(data.metrics.totalEngagement.current),
      String(data.metrics.totalEngagement.previous),
      data.metrics.totalEngagement.changePercent !== null
        ? `${data.metrics.totalEngagement.changePercent}%`
        : "-",
    ]);
    rows.push([
      "Engagement Rate (%)",
      `${data.metrics.engagementRate.current}%`,
      `${data.metrics.engagementRate.previous}%`,
      data.metrics.engagementRate.changePercent !== null
        ? `${data.metrics.engagementRate.changePercent}%`
        : "-",
    ]);
    rows.push([
      "Searches (ការស្វែងរក)",
      String(data.metrics.searches.current),
      String(data.metrics.searches.previous),
      data.metrics.searches.changePercent !== null
        ? `${data.metrics.searches.changePercent}%`
        : "-",
    ]);
    rows.push([
      "Unique Search Terms (ពាក្យស្វែងរកប្លែកៗ)",
      String(data.metrics.uniqueQueries.current),
      String(data.metrics.uniqueQueries.previous),
      data.metrics.uniqueQueries.changePercent !== null
        ? `${data.metrics.uniqueQueries.changePercent}%`
        : "-",
    ]);
    rows.push([
      "Search CTR (%)",
      `${data.metrics.searchCtr.current}%`,
      `${data.metrics.searchCtr.previous}%`,
      data.metrics.searchCtr.changePercent !== null
        ? `${data.metrics.searchCtr.changePercent}%`
        : "-",
    ]);
  } else if (reportType === "content-performance") {
    const data = await getPostgresContentPerformance(period, customStartDate, customEndDate);
    rows.push(["Wat Peareang Digital Archive - Content Performance Report"]);
    rows.push(["Period", period]);
    rows.push([]);
    rows.push(["-- FESTIVAL PERFORMANCE --"]);
    rows.push([
      "Festival ID",
      "Festival Name",
      "Month",
      "Albums Count",
      "Images Count",
      "Total Views",
      "Total Likes",
      "Total Favorites",
      "Search Clicks",
      "Popularity Score",
    ]);
    for (const f of data.festivals) {
      rows.push([
        f.festivalId,
        f.name,
        f.month,
        String(f.albumsCount),
        String(f.imagesCount),
        String(f.totalViews),
        String(f.totalLikes),
        String(f.totalFavorites),
        String(f.searchClicksCount),
        String(f.popularityScore),
      ]);
    }

    rows.push([]);
    rows.push(["-- ALBUMS PERFORMANCE --"]);
    rows.push([
      "Album ID",
      "Title",
      "Festival",
      "Year",
      "Photos",
      "Views",
      "Likes",
      "Favorites",
      "Search Clicks",
      "Popularity Score",
    ]);
    for (const a of data.albums) {
      rows.push([
        a.albumId,
        a.title,
        a.festivalName,
        String(a.year),
        String(a.photoCount),
        String(a.viewsCount),
        String(a.likesCount),
        String(a.favoritesCount),
        String(a.searchClicksCount),
        String(a.popularityScore),
      ]);
    }
  } else if (reportType === "top-albums") {
    const albums = await getPostgresTopAlbums(validPeriod, 100);
    rows.push(["Wat Peareang Digital Archive - Top Viewed Albums"]);
    rows.push(["Period", period]);
    rows.push([]);
    rows.push(["Rank", "Album Title", "Festival", "Year", "Photos", "Views"]);
    for (const a of albums) {
      rows.push([
        String(a.rank),
        a.title,
        a.festivalName,
        String(a.year),
        String(a.photoCount),
        String(a.views),
      ]);
    }
  } else if (reportType === "top-images") {
    const images = await getPostgresTopImages(validPeriod, 100);
    rows.push(["Wat Peareang Digital Archive - Top Viewed Images"]);
    rows.push(["Period", period]);
    rows.push([]);
    rows.push(["Rank", "Image Title", "Album", "Views"]);
    for (const img of images) {
      rows.push([String(img.rank), img.title, img.albumTitle, String(img.views)]);
    }
  } else if (reportType === "search-queries") {
    const data = await getPostgresSearchAnalytics(validPeriod);
    rows.push(["Wat Peareang Digital Archive - Search Analytics Report"]);
    rows.push(["Period", period]);
    rows.push([]);
    rows.push(["-- TOP SEARCH QUERIES --"]);
    rows.push([
      "Query",
      "Search Count",
      "Average Results",
      "Click Count",
      "CTR (%)",
      "Last Searched At",
    ]);
    for (const q of data.topQueries) {
      rows.push([
        q.query,
        String(q.searchCount),
        String(q.avgResults),
        String(q.clickCount),
        `${q.ctrPercent}%`,
        q.lastSearchedAt,
      ]);
    }
    rows.push([]);
    rows.push(["-- ZERO RESULT QUERIES (CONTENT GAPS) --"]);
    rows.push(["Query", "Search Count", "Suggested Action", "Last Searched At"]);
    for (const z of data.zeroResultQueries) {
      rows.push([z.query, String(z.searchCount), z.suggestedAction, z.lastSearchedAt]);
    }
  } else if (reportType === "growth") {
    const data = await getPostgresArchiveGrowth("month");
    rows.push(["Wat Peareang Digital Archive - Content Growth Report"]);
    rows.push([]);
    rows.push([
      "Period",
      "New Festivals",
      "New Years",
      "New Albums",
      "New Images",
      "Cumulative Albums",
      "Cumulative Images",
    ]);
    for (const g of data.timeline) {
      rows.push([
        g.periodLabel,
        String(g.newFestivals),
        String(g.newYears),
        String(g.newAlbums),
        String(g.newImages),
        String(g.cumulativeAlbums),
        String(g.cumulativeImages),
      ]);
    }
  } else if (reportType === "activity") {
    const data = await getPostgresAdminActivitySummary(period, customStartDate, customEndDate);
    rows.push(["Wat Peareang Digital Archive - Admin Activity Audit Log"]);
    rows.push(["Period", period]);
    rows.push([]);
    rows.push(["Timestamp", "User Name", "User Role", "Action", "Resource", "Details", "IP"]);
    for (const log of data.recentLogs) {
      rows.push([
        log.timestamp,
        log.userName,
        log.userRole,
        log.action,
        log.resource,
        log.details || "",
        log.ip || "",
      ]);
    }
  } else {
    // "all" - comprehensive report
    const summary = await getPostgresReportsSummary(period, customStartDate, customEndDate);
    const contentPerf = await getPostgresContentPerformance(period, customStartDate, customEndDate);
    const topAlb = await getPostgresTopAlbums(validPeriod, 20);
    const searchData = await getPostgresSearchAnalytics(validPeriod);

    rows.push(["Wat Peareang Digital Archive - Master Intelligence & Performance Report"]);
    rows.push(["Generated At", new Date().toISOString(), "Period", period]);
    rows.push([]);
    rows.push(["-- EXECUTIVE KPI SUMMARY --"]);
    rows.push(["Metric", "Current Value", "Previous Value", "Change (%)"]);
    rows.push([
      "Unique Visitors",
      String(summary.metrics.uniqueVisitors.current),
      String(summary.metrics.uniqueVisitors.previous),
      summary.metrics.uniqueVisitors.changePercent !== null
        ? `${summary.metrics.uniqueVisitors.changePercent}%`
        : "-",
    ]);
    rows.push([
      "Total Views",
      String(summary.metrics.totalViews.current),
      String(summary.metrics.totalViews.previous),
      summary.metrics.totalViews.changePercent !== null
        ? `${summary.metrics.totalViews.changePercent}%`
        : "-",
    ]);
    rows.push([
      "Total Engagement",
      String(summary.metrics.totalEngagement.current),
      String(summary.metrics.totalEngagement.previous),
      summary.metrics.totalEngagement.changePercent !== null
        ? `${summary.metrics.totalEngagement.changePercent}%`
        : "-",
    ]);
    rows.push([
      "Total Searches",
      String(summary.metrics.searches.current),
      String(summary.metrics.searches.previous),
      summary.metrics.searches.changePercent !== null
        ? `${summary.metrics.searches.changePercent}%`
        : "-",
    ]);
    rows.push([]);
    rows.push(["-- TOP FESTIVALS --"]);
    rows.push(["Festival", "Albums", "Images", "Total Views", "Engagement", "Popularity Score"]);
    for (const f of contentPerf.festivals.slice(0, 10)) {
      rows.push([
        f.name,
        String(f.albumsCount),
        String(f.imagesCount),
        String(f.totalViews),
        String(f.totalLikes + f.totalFavorites),
        String(f.popularityScore),
      ]);
    }
    rows.push([]);
    rows.push(["-- TOP SEARCH QUERIES --"]);
    rows.push(["Query", "Searches", "CTR (%)", "Avg Results"]);
    for (const q of searchData.topQueries.slice(0, 15)) {
      rows.push([q.query, String(q.searchCount), `${q.ctrPercent}%`, String(q.avgResults)]);
    }
  }

  const csvString = BOM + rows.map((r) => r.map((c) => escapeCsv(c)).join(",")).join("\r\n");

  return {
    content: csvString,
    mimeType: "text/csv; charset=utf-8",
    filename: cleanFilename,
  };
}

// ============================================================================
// HIERARCHICAL ARCHIVE (FESTIVAL -> YEAR -> EVENTS -> ALBUMS -> PHOTOS)
// ============================================================================

export interface DbEvent {
  id: string;
  festivalId: string;
  year: number;
  nameKh: string;
  nameEn?: string | null;
  description?: string | null;
  eventDate?: string | null;
  location: string;
  icon: string;
  coverImage?: string | null;
  status: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DbEventWithAlbums extends DbEvent {
  albums: DbAlbum[];
  photoCount: number;
}

/**
 * Validate Hierarchy Integrity for Festival -> Year -> Event -> Album
 * Ensures:
 * 1. Festival exists
 * 2. Year exists
 * 3. Event (if specified) exists and strictly belongs to the specified (festivalId, year)
 * 4. Cross-festival and cross-year assignments are strictly rejected
 */
export async function validateHierarchyIntegrity(params: {
  festivalId: string;
  year: number;
  eventId?: string | null | undefined;
}): Promise<{ valid: boolean; error?: string }> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return { valid: true };
  }

  try {
    const { festivalId, year, eventId } = params;

    // 1. Verify Festival exists
    const [festival] = await db
      .select({ id: schema.festivals.id })
      .from(schema.festivals)
      .where(eq(schema.festivals.id, festivalId))
      .limit(1);

    if (!festival) {
      return {
        valid: false,
        error: `ពិធីបុណ្យ ID "${festivalId}" មិនមាននៅក្នុងប្រព័ន្ធឡើយ។`,
      };
    }

    // 2. Verify Year exists
    const [yearRow] = await db
      .select({ year: schema.years.year })
      .from(schema.years)
      .where(eq(schema.years.year, year))
      .limit(1);

    if (!yearRow) {
      return {
        valid: false,
        error: `ឆ្នាំ ${year} មិនមាននៅក្នុងបញ្ជីឆ្នាំនៃបណ្ណសារឡើយ។`,
      };
    }

    // 3. If eventId is provided, verify Event exists AND strictly belongs to the same festival and year
    if (eventId && eventId.trim() !== "") {
      const [event] = await db
        .select({
          id: schema.events.id,
          festivalId: schema.events.festivalId,
          year: schema.events.year,
          nameKh: schema.events.nameKh,
        })
        .from(schema.events)
        .where(eq(schema.events.id, eventId.trim()))
        .limit(1);

      if (!event) {
        return {
          valid: false,
          error: `ព្រឹត្តិការណ៍ ID "${eventId}" មិនមាននៅក្នុងប្រព័ន្ធឡើយ។`,
        };
      }

      // STRICT INTEGRITY CHECK: Event MUST match both festivalId and year
      if (event.festivalId !== festivalId || event.year !== year) {
        return {
          valid: false,
          error: `Hierarchy violation: ព្រឹត្តិការណ៍ «${event.nameKh}» ជាកម្មសិទ្ធិរបស់ (${event.festivalId}, ${event.year}) មិនអាចចាត់តាំងទៅ (${festivalId}, ${year}) បានទេ។`,
        };
      }
    }

    return { valid: true };
  } catch (err) {
    console.error("[PostgreSQL Query Error] validateHierarchyIntegrity failed:", err);
    return {
      valid: false,
      error: "មានបញ្ហាក្នុងការផ្ទៀងផ្ទាត់សុចរិតភាព Hierarchy ក្នុង Database។",
    };
  }
}

/**
 * Fetch all events (with their nested child albums) for a festival and year
 */
export async function getPostgresEventsForFestivalYear(
  festivalId: string,
  year: number,
): Promise<DbEventWithAlbums[]> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return [];
  }

  try {
    // 1. Fetch active events sorted by sortOrder
    const eventRows = await db
      .select()
      .from(schema.events)
      .where(
        and(
          eq(schema.events.festivalId, festivalId),
          eq(schema.events.year, year),
          or(eq(schema.events.status, "published"), eq(schema.events.status, "active")),
        ),
      )
      .orderBy(asc(schema.events.sortOrder), asc(schema.events.createdAt));

    // 2. Fetch all published albums for this festival and year
    const albumRows = await db
      .select()
      .from(schema.albums)
      .where(
        and(
          eq(schema.albums.festivalId, festivalId),
          eq(schema.albums.year, year),
          or(eq(schema.albums.status, "published"), eq(schema.albums.status, "approved")),
        ),
      )
      .orderBy(asc(schema.albums.sortOrder), asc(schema.albums.createdAt));

    // 3. Fetch festival metadata for album mapping
    const [fest] = await db
      .select()
      .from(schema.festivals)
      .where(eq(schema.festivals.id, festivalId))
      .limit(1);

    const festivalMeta = fest
      ? {
          id: fest.id,
          name: fest.name,
          emoji: fest.emoji,
          accent: fest.accent,
          month: fest.month,
          cover: fest.coverUrl || "",
        }
      : {
          id: festivalId,
          name: festivalId,
          emoji: "🎉",
          accent: "#D4AF37",
          month: "",
          cover: "",
        };

    const mapAlbum = (a: typeof albumRows[0]): DbAlbum => ({
      id: a.id,
      festivalId: a.festivalId,
      year: a.year,
      eventId: a.eventId,
      title: a.title,
      description: a.description || undefined,
      location: a.location,
      coverImage: a.coverImage || undefined,
      photoCount: a.photoCount,
      status: a.status as "published" | "draft" | "trashed",
      viewsCount: a.viewsCount,
      likesCount: a.likesCount,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      festival: festivalMeta,
    });

    const mappedAlbums = albumRows.map(mapAlbum);

    // Group albums by eventId
    const albumsByEvent = new Map<string, DbAlbum[]>();
    const unassignedAlbums: DbAlbum[] = [];

    for (const alb of mappedAlbums) {
      if (alb.eventId) {
        const list = albumsByEvent.get(alb.eventId) || [];
        list.push(alb);
        albumsByEvent.set(alb.eventId, list);
      } else {
        unassignedAlbums.push(alb);
      }
    }

    const result: DbEventWithAlbums[] = eventRows.map((ev) => {
      const evAlbums = albumsByEvent.get(ev.id) || [];
      const totalPhotos = evAlbums.reduce((sum, a) => sum + (a.photoCount || 0), 0);
      return {
        id: ev.id,
        festivalId: ev.festivalId,
        year: ev.year,
        nameKh: ev.nameKh,
        nameEn: ev.nameEn,
        description: ev.description,
        eventDate: ev.eventDate,
        location: ev.location,
        icon: ev.icon,
        coverImage: ev.coverImage,
        status: ev.status,
        sortOrder: ev.sortOrder,
        createdAt: ev.createdAt.toISOString(),
        updatedAt: ev.updatedAt.toISOString(),
        albums: evAlbums,
        photoCount: totalPhotos,
      };
    });

    // If there are albums without a specific eventId, include a general ceremony event container
    if (unassignedAlbums.length > 0) {
      result.push({
        id: `${festivalId}-${year}-general`,
        festivalId,
        year,
        nameKh: "ពិធីបុណ្យទូទៅ & កម្រងរូបភាពរួម",
        nameEn: "General Celebrations & Albums",
        description: `កម្រងរូបភាពទូទៅនៃ ${festivalMeta.name} ប្រចាំឆ្នាំ ${year}`,
        eventDate: null,
        location: "វត្តពារាំង",
        icon: festivalMeta.emoji || "🎉",
        coverImage: null,
        status: "published",
        sortOrder: 9999,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        albums: unassignedAlbums,
        photoCount: unassignedAlbums.reduce((sum, a) => sum + (a.photoCount || 0), 0),
      });
    }

    return result;
  } catch (err) {
    console.error("[PostgreSQL Query Error] getPostgresEventsForFestivalYear failed:", err);
    return [];
  }
}

/**
 * Fetch a single event by ID with its child albums
 */
export async function getPostgresEventById(eventId: string): Promise<DbEventWithAlbums | null> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return null;
  }

  try {
    const [event] = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, eventId))
      .limit(1);

    if (!event) return null;

    const albumRows = await db
      .select()
      .from(schema.albums)
      .where(
        and(
          eq(schema.albums.eventId, eventId),
          or(eq(schema.albums.status, "published"), eq(schema.albums.status, "approved")),
        ),
      )
      .orderBy(asc(schema.albums.sortOrder), asc(schema.albums.createdAt));

    const [fest] = await db
      .select()
      .from(schema.festivals)
      .where(eq(schema.festivals.id, event.festivalId))
      .limit(1);

    const festivalMeta = fest
      ? {
          id: fest.id,
          name: fest.name,
          emoji: fest.emoji,
          accent: fest.accent,
          month: fest.month,
          cover: fest.coverUrl || "",
        }
      : {
          id: event.festivalId,
          name: event.festivalId,
          emoji: "🎉",
          accent: "#D4AF37",
          month: "",
          cover: "",
        };

    const albums: DbAlbum[] = albumRows.map((a) => ({
      id: a.id,
      festivalId: a.festivalId,
      year: a.year,
      eventId: a.eventId,
      title: a.title,
      description: a.description || undefined,
      location: a.location,
      coverImage: a.coverImage || undefined,
      photoCount: a.photoCount,
      status: a.status as "published" | "draft" | "trashed",
      viewsCount: a.viewsCount,
      likesCount: a.likesCount,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      festival: festivalMeta,
    }));

    return {
      id: event.id,
      festivalId: event.festivalId,
      year: event.year,
      nameKh: event.nameKh,
      nameEn: event.nameEn,
      description: event.description,
      eventDate: event.eventDate,
      location: event.location,
      icon: event.icon,
      coverImage: event.coverImage,
      status: event.status,
      sortOrder: event.sortOrder,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      albums,
      photoCount: albums.reduce((sum, a) => sum + (a.photoCount || 0), 0),
    };
  } catch (err) {
    console.error("[PostgreSQL Query Error] getPostgresEventById failed:", err);
    return null;
  }
}

/**
 * Fetch paginated & filtered events for Admin management
 */
export async function getPostgresAdminEvents(filters: {
  search?: string | undefined;
  festivalId?: string | undefined;
  year?: number | string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
} = {}): Promise<{ events: (DbEvent & { albumsCount: number })[]; total: number; page: number; totalPages: number }> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    return { events: [], total: 0, page: 1, totalPages: 1 };
  }

  const page = Math.max(1, filters.page || 1);
  const limit = Math.max(1, Math.min(100, filters.limit || 25));
  const offset = (page - 1) * limit;

  try {
    const conditions = [];

    if (filters.festivalId && filters.festivalId !== "all") {
      conditions.push(eq(schema.events.festivalId, filters.festivalId));
    }

    if (filters.year && filters.year !== "all") {
      conditions.push(eq(schema.events.year, Number(filters.year)));
    }

    if (filters.search && filters.search.trim()) {
      const q = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.events.nameKh, q),
          ilike(schema.events.nameEn, q),
          ilike(schema.events.description, q),
          ilike(schema.events.location, q),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count
    const countRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.events)
      .where(whereClause);
    const total = countRes[0]?.count ?? 0;

    // Rows
    const rows = await db
      .select()
      .from(schema.events)
      .where(whereClause)
      .orderBy(asc(schema.events.festivalId), desc(schema.events.year), asc(schema.events.sortOrder))
      .limit(limit)
      .offset(offset);

    // Album counts per event
    const eventIds = rows.map((r) => r.id);
    const albumCountMap = new Map<string, number>();

    if (eventIds.length > 0) {
      const albumCounts = await db
        .select({
          eventId: schema.albums.eventId,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.albums)
        .where(
          and(
            inArray(schema.albums.eventId, eventIds),
            ne(schema.albums.status, "trashed"),
          ),
        )
        .groupBy(schema.albums.eventId);

      for (const ac of albumCounts) {
        if (ac.eventId) {
          albumCountMap.set(ac.eventId, ac.count);
        }
      }
    }

    const eventList = rows.map((r) => ({
      id: r.id,
      festivalId: r.festivalId,
      year: r.year,
      nameKh: r.nameKh,
      nameEn: r.nameEn,
      description: r.description,
      eventDate: r.eventDate,
      location: r.location,
      icon: r.icon,
      coverImage: r.coverImage,
      status: r.status,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      albumsCount: albumCountMap.get(r.id) || 0,
    }));

    return {
      events: eventList,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  } catch (err) {
    console.error("[PostgreSQL Query Error] getPostgresAdminEvents failed:", err);
    return { events: [], total: 0, page: 1, totalPages: 1 };
  }
}

/**
 * Admin: Create a new Event with hierarchy validation
 */
export async function createPostgresEvent(data: {
  id?: string;
  festivalId: string;
  year: number;
  nameKh: string;
  nameEn?: string | undefined;
  description?: string | undefined;
  eventDate?: string | undefined;
  location?: string | undefined;
  icon?: string | undefined;
  coverImage?: string | undefined;
  status?: string | undefined;
  sortOrder?: number | undefined;
}): Promise<DbEvent> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    throw new Error("Database connection is not configured.");
  }

  // Validate hierarchy integrity (Festival & Year must exist)
  const validation = await validateHierarchyIntegrity({
    festivalId: data.festivalId,
    year: data.year,
  });

  if (!validation.valid) {
    throw new Error(validation.error || "Hierarchy validation failed.");
  }

  const generatedId =
    data.id ||
    `${data.festivalId}-${data.year}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  const now = new Date();
  const [created] = await db
    .insert(schema.events)
    .values({
      id: generatedId,
      festivalId: data.festivalId,
      year: data.year,
      nameKh: data.nameKh.trim(),
      nameEn: data.nameEn?.trim() || null,
      description: data.description?.trim() || null,
      eventDate: data.eventDate?.trim() || null,
      location: data.location?.trim() || "វត្តពារាំង",
      icon: data.icon?.trim() || "🎉",
      coverImage: data.coverImage?.trim() || null,
      status: data.status || "published",
      sortOrder: data.sortOrder || 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to insert event record.");
  }

  return {
    id: created.id,
    festivalId: created.festivalId,
    year: created.year,
    nameKh: created.nameKh,
    nameEn: created.nameEn,
    description: created.description,
    eventDate: created.eventDate,
    location: created.location,
    icon: created.icon,
    coverImage: created.coverImage,
    status: created.status,
    sortOrder: created.sortOrder,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
}

/**
 * Admin: Update an Event with hierarchy validation
 */
export async function updatePostgresEvent(
  id: string,
  updates: {
    festivalId?: string | undefined;
    year?: number | undefined;
    nameKh?: string | undefined;
    nameEn?: string | undefined;
    description?: string | undefined;
    eventDate?: string | undefined;
    location?: string | undefined;
    icon?: string | undefined;
    coverImage?: string | undefined;
    status?: string | undefined;
    sortOrder?: number | undefined;
  },
): Promise<DbEvent> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    throw new Error("Database connection is not configured.");
  }

  const [existing] = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.id, id))
    .limit(1);

  if (!existing) {
    throw new Error("Event not found.");
  }

  const targetFestivalId = updates.festivalId || existing.festivalId;
  const targetYear = updates.year || existing.year;

  // Validate hierarchy integrity if festival or year changed
  if (updates.festivalId || updates.year) {
    const validation = await validateHierarchyIntegrity({
      festivalId: targetFestivalId,
      year: targetYear,
    });
    if (!validation.valid) {
      throw new Error(validation.error || "Hierarchy validation failed.");
    }
  }

  const [updated] = await db
    .update(schema.events)
    .set({
      festivalId: targetFestivalId,
      year: targetYear,
      nameKh: updates.nameKh !== undefined ? updates.nameKh.trim() : existing.nameKh,
      nameEn: updates.nameEn !== undefined ? updates.nameEn.trim() || null : existing.nameEn,
      description:
        updates.description !== undefined
          ? updates.description.trim() || null
          : existing.description,
      eventDate:
        updates.eventDate !== undefined ? updates.eventDate.trim() || null : existing.eventDate,
      location:
        updates.location !== undefined ? updates.location.trim() || "វត្តពារាំង" : existing.location,
      icon: updates.icon !== undefined ? updates.icon.trim() || "🎉" : existing.icon,
      coverImage:
        updates.coverImage !== undefined ? updates.coverImage.trim() || null : existing.coverImage,
      status: updates.status || existing.status,
      sortOrder: updates.sortOrder !== undefined ? updates.sortOrder : existing.sortOrder,
      updatedAt: new Date(),
    })
    .where(eq(schema.events.id, id))
    .returning();

  if (!updated) {
    throw new Error("Failed to update event record.");
  }

  return {
    id: updated.id,
    festivalId: updated.festivalId,
    year: updated.year,
    nameKh: updated.nameKh,
    nameEn: updated.nameEn,
    description: updated.description,
    eventDate: updated.eventDate,
    location: updated.location,
    icon: updated.icon,
    coverImage: updated.coverImage,
    status: updated.status,
    sortOrder: updated.sortOrder,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

/**
 * Admin: Safe delete event (albums.event_id will be nullified, albums and photos are preserved)
 */
export async function deletePostgresEvent(id: string): Promise<boolean> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    throw new Error("Database connection is not configured.");
  }

  // Explicitly nullify event_id on child albums before deletion to guarantee zero album loss
  await db
    .update(schema.albums)
    .set({ eventId: null, updatedAt: new Date() })
    .where(eq(schema.albums.eventId, id));

  // Delete event row
  await db.delete(schema.events).where(eq(schema.events.id, id));
  return true;
}

/**
 * Admin: Reorder events
 */
export async function reorderPostgresEvents(eventIds: string[]): Promise<boolean> {
  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    throw new Error("Database connection is not configured.");
  }

  for (let i = 0; i < eventIds.length; i++) {
    const eventId = eventIds[i];
    if (eventId) {
      await db
        .update(schema.events)
        .set({ sortOrder: i + 1, updatedAt: new Date() })
        .where(eq(schema.events.id, eventId));
    }
  }

  return true;
}
