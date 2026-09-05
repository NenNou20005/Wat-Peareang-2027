import chaulChnam from "@/assets/fest-chaul-chnam.jpg";
import visak from "@/assets/fest-visak.jpg";
import meak from "@/assets/fest-meak.jpg";
import cholVossa from "@/assets/fest-chol-vossa.jpg";
import chenhVossa from "@/assets/fest-chenh-vossa.jpg";
import pchumBen from "@/assets/fest-pchum-ben.jpg";
import kathin from "@/assets/fest-kathin.jpg";
import omTouk from "@/assets/fest-om-touk.jpg";

export type Festival = {
  id: string;
  name: string;
  emoji: string;
  cover: string;
  accent: string;
  month: string;
};

export const festivals: Festival[] = [
  {
    id: "chaul-chnam",
    name: "បុណ្យចូលឆ្នាំខ្មែរ",
    emoji: "🎉",
    cover: chaulChnam,
    accent: "var(--fest-newyear)",
    month: "មេសា",
  },
  {
    id: "visak-bochea",
    name: "បុណ្យវិសាខបូជា",
    emoji: "🛕",
    cover: visak,
    accent: "var(--fest-visak)",
    month: "ឧសភា",
  },
  {
    id: "meak-bochea",
    name: "បុណ្យមាឃបូជា",
    emoji: "🕯️",
    cover: meak,
    accent: "var(--fest-meak)",
    month: "កុម្ភៈ",
  },
  {
    id: "chol-vossa",
    name: "បុណ្យចូលវស្សា",
    emoji: "🌾",
    cover: cholVossa,
    accent: "var(--fest-cholvossa)",
    month: "កក្កដា",
  },
  {
    id: "chenh-vossa",
    name: "បុណ្យចេញវស្សា",
    emoji: "🪷",
    cover: chenhVossa,
    accent: "var(--fest-chenhvossa)",
    month: "តុលា",
  },
  {
    id: "pchum-ben",
    name: "បុណ្យភ្ជុំបិណ្ឌ",
    emoji: "👻",
    cover: pchumBen,
    accent: "var(--fest-pchumben)",
    month: "កញ្ញា",
  },
  {
    id: "kathin",
    name: "បុណ្យកឋិនទាន",
    emoji: "🕊️",
    cover: kathin,
    accent: "var(--fest-kathin)",
    month: "តុលា",
  },
  {
    id: "om-touk",
    name: "បុណ្យអុំទូក",
    emoji: "🚣",
    cover: omTouk,
    accent: "var(--fest-omtouk)",
    month: "វិច្ឆិកា",
  },
  {
    id: "dar-lean",
    name: "បុណ្យដារលាន",
    emoji: "🌾",
    cover: cholVossa,
    accent: "oklch(0.68 0.14 85)",
    month: "មករា/កុម្ភៈ",
  },
  {
    id: "pka-samaki",
    name: "បុណ្យផ្កាប្រាក់សាមគ្គី",
    emoji: "🌸",
    cover: chenhVossa,
    accent: "oklch(0.62 0.16 350)",
    month: "មីនា",
  },
  {
    id: "chlong-preah-vihear",
    name: "បុណ្យឆ្លងព្រះវិហារ",
    emoji: "🛕",
    cover: visak,
    accent: "oklch(0.55 0.12 165)",
    month: "ពេញមួយឆ្នាំ",
  },
  {
    id: "bombuos-neak",
    name: "បុណ្យបំបួសនាគ",
    emoji: "🐉",
    cover: chaulChnam,
    accent: "oklch(0.65 0.15 50)",
    month: "មិថុនា",
  },
  {
    id: "laeng-neakta",
    name: "បុណ្យឡើងអ្នកតា",
    emoji: "🏮",
    cover: pchumBen,
    accent: "oklch(0.58 0.16 30)",
    month: "ឧសភា",
  },
  {
    id: "chrot-preah-nongkoal",
    name: "បុណ្យច្រត់ព្រះនង្គ័ល",
    emoji: "🐂",
    cover: cholVossa,
    accent: "oklch(0.58 0.13 140)",
    month: "ឧសភា",
  },
  {
    id: "puthea-pisek",
    name: "បុណ្យពុទ្ធាភិសេក",
    emoji: "✨",
    cover: meak,
    accent: "oklch(0.72 0.14 80)",
    month: "ពេញមួយឆ្នាំ",
  },
  {
    id: "pachay-buon",
    name: "បុណ្យបច្ច័យបួន",
    emoji: "🕯️",
    cover: kathin,
    accent: "oklch(0.48 0.12 280)",
    month: "ពេញមួយឆ្នាំ",
  },
];

export const PREDEFINED_EXTRA_FESTIVALS: Festival[] = festivals.slice(8);

export const STORAGE_CUSTOM_FESTIVALS_KEY = "watpeareang_custom_festivals";

export function getCustomFestivals(): Festival[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_FESTIVALS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomFestival(fest: Festival): Festival[] {
  if (typeof window === "undefined") return [];
  try {
    const current = getCustomFestivals();
    const updated = [...current.filter((f) => f.id !== fest.id), fest];
    localStorage.setItem(STORAGE_CUSTOM_FESTIVALS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("watpeareang-festivals-updated"));
    return updated;
  } catch {
    return [];
  }
}

export const years = [2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];

const locations = ["វត្តពារាំង"];

export type Album = {
  id: string;
  festivalId: string;
  festival: Festival;
  year: number;
  location: string;
  photoCount: number;
  videoCount?: number | undefined;
  title: string;
  description?: string | null | undefined;
  coverImage?: string | null | undefined;
};

export const sampleImages = festivals.map((f) => f.cover);

function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100000;
  return h;
}

export function getAllFestivals(): Festival[] {
  const custom = getCustomFestivals();
  if (!custom.length) return festivals;
  const existingIds = new Set(festivals.map((f) => f.id));
  return [...festivals, ...custom.filter((c) => !existingIds.has(c.id))];
}

export function generateAlbumsForFestival(f: Festival, allYears: number[] = years): Album[] {
  return allYears.map((year) => {
    const seed = hash(`${f.id}-${year}`);
    return {
      id: `${f.id}-${year}`,
      festivalId: f.id,
      festival: f,
      year,
      location: locations[seed % locations.length]!,
      photoCount: 32 + (seed % 19),
      title: f.name,
    };
  });
}

export const albums: Album[] = years.flatMap((year) =>
  festivals.map((f) => {
    const seed = hash(`${f.id}-${year}`);
    return {
      id: `${f.id}-${year}`,
      festivalId: f.id,
      festival: f,
      year,
      location: locations[seed % locations.length]!,
      photoCount: 32 + (seed % 19),
      title: f.name,
    };
  }),
);

export function getAllAlbums(): Album[] {
  const custom = getCustomFestivals();
  if (!custom.length) return albums;
  const customAlbums = custom.flatMap((f) => generateAlbumsForFestival(f));
  return [...albums, ...customAlbums];
}

export const KHMER_DIGITS = ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"];

export function toKhmerNumber(value: number | string) {
  return String(value).replace(/\d/g, (d) => KHMER_DIGITS[Number(d)]!);
}

export function albumsByYear(year: number) {
  return getAllAlbums().filter((a) => a.year === year);
}

export function getAlbum(id: string) {
  return getAllAlbums().find((a) => a.id === id);
}

export function yearStats(year: number) {
  const list = albumsByYear(year);
  return {
    albums: list.length,
    photos: list.reduce((sum, a) => sum + a.photoCount, 0),
    locations: new Set(list.map((a) => a.location)).size,
  };
}

/** Deterministic gallery for an album, reusing archive imagery. */
export function albumPhotos(album: Album) {
  const pool = festivals.map((f) => f.cover);
  return Array.from({ length: album.photoCount }, (_, i) => {
    const seed = hash(`${album.id}-${i}`);
    return {
      id: `${album.id}-${i}`,
      src: i % 3 === 0 ? album.festival.cover : pool[seed % pool.length]!,
      caption: `${album.festival.name} · រូបទី ${toKhmerNumber(i + 1)}`,
      tall: seed % 5 === 0,
    };
  });
}

export function searchAlbums(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return getAllAlbums().filter((a) => {
    const hay = [a.festival.name, String(a.year), toKhmerNumber(a.year), a.festivalId]
      .join(" ")
      .toLowerCase();
    return q.split(/\s+/).every((part) => hay.includes(part));
  });
}
