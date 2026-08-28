export type Festival = {
  id: string;
  name: string;
  emoji: string;
  cover: string;
  accent: string;
  month: string;
};

export const STATIC_FESTIVALS: Festival[] = [
  {
    id: "chaul-chnam",
    name: "បុណ្យចូលឆ្នាំខ្មែរ",
    emoji: "🎉",
    cover: "/assets/fest-chaul-chnam.jpg",
    accent: "var(--fest-newyear)",
    month: "មេសា",
  },
  {
    id: "visak-bochea",
    name: "បុណ្យវិសាខបូជា",
    emoji: "🛕",
    cover: "/assets/fest-visak.jpg",
    accent: "var(--fest-visak)",
    month: "ឧសភា",
  },
  {
    id: "meak-bochea",
    name: "បុណ្យមាឃបូជា",
    emoji: "🕯️",
    cover: "/assets/fest-meak.jpg",
    accent: "var(--fest-meak)",
    month: "កុម្ភៈ",
  },
  {
    id: "chol-vossa",
    name: "បុណ្យចូលវស្សា",
    emoji: "🌾",
    cover: "/assets/fest-chol-vossa.jpg",
    accent: "var(--fest-cholvossa)",
    month: "កក្កដា",
  },
  {
    id: "chenh-vossa",
    name: "បុណ្យចេញវស្សា",
    emoji: "🪷",
    cover: "/assets/fest-chenh-vossa.jpg",
    accent: "var(--fest-chenhvossa)",
    month: "តុលា",
  },
  {
    id: "pchum-ben",
    name: "បុណ្យភ្ជុំបិណ្ឌ",
    emoji: "👻",
    cover: "/assets/fest-pchum-ben.jpg",
    accent: "var(--fest-pchumben)",
    month: "កញ្ញា",
  },
  {
    id: "kathin",
    name: "បុណ្យកឋិនទាន",
    emoji: "🕊️",
    cover: "/assets/fest-kathin.jpg",
    accent: "var(--fest-kathin)",
    month: "តុលា",
  },
  {
    id: "om-touk",
    name: "បុណ្យអុំទូក",
    emoji: "🚣",
    cover: "/assets/fest-om-touk.jpg",
    accent: "var(--fest-omtouk)",
    month: "វិច្ឆិកា",
  },
];

export const STATIC_PREDEFINED_EXTRA_FESTIVALS: Festival[] = [
  {
    id: "dar-lean",
    name: "បុណ្យដារលាន",
    emoji: "🌾",
    cover: "/assets/fest-chol-vossa.jpg",
    accent: "oklch(0.68 0.14 85)",
    month: "មករា/កុម្ភៈ",
  },
  {
    id: "pka-samaki",
    name: "បុណ្យផ្កាប្រាក់សាមគ្គី",
    emoji: "🌸",
    cover: "/assets/fest-chenh-vossa.jpg",
    accent: "oklch(0.62 0.16 350)",
    month: "មីនា",
  },
  {
    id: "chlong-preah-vihear",
    name: "បុណ្យឆ្លងព្រះវិហារ",
    emoji: "🛕",
    cover: "/assets/fest-visak.jpg",
    accent: "oklch(0.55 0.12 165)",
    month: "ពេញមួយឆ្នាំ",
  },
  {
    id: "bombuos-neak",
    name: "បុណ្យបំបួសនាគ",
    emoji: "🐉",
    cover: "/assets/fest-chaul-chnam.jpg",
    accent: "oklch(0.65 0.15 50)",
    month: "មិថុនា",
  },
  {
    id: "laeng-neakta",
    name: "បុណ្យឡើងអ្នកតា",
    emoji: "🏮",
    cover: "/assets/fest-pchum-ben.jpg",
    accent: "oklch(0.58 0.16 30)",
    month: "ឧសភា",
  },
  {
    id: "chrot-preah-nongkoal",
    name: "បុណ្យច្រត់ព្រះនង្គ័ល",
    emoji: "🐂",
    cover: "/assets/fest-chol-vossa.jpg",
    accent: "oklch(0.58 0.13 140)",
    month: "ឧសភា",
  },
  {
    id: "puthea-pisek",
    name: "បុណ្យពុទ្ធាភិសេក",
    emoji: "✨",
    cover: "/assets/fest-meak.jpg",
    accent: "oklch(0.72 0.14 80)",
    month: "ពេញមួយឆ្នាំ",
  },
  {
    id: "pachay-buon",
    name: "បុណ្យបច្ច័យបួន",
    emoji: "🕯️",
    cover: "/assets/fest-kathin.jpg",
    accent: "oklch(0.48 0.12 280)",
    month: "ពេញមួយឆ្នាំ",
  },
];

export const STATIC_YEARS: number[] = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2018];

const locations = ["វត្តពារាំង"];

export type Album = {
  id: string;
  festivalId: string;
  festival: Festival;
  year: number;
  location: string;
  photoCount: number;
  title: string;
  coverImage?: string | null | undefined;
};

export function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100000;
  return h;
}

export const KHMER_DIGITS = ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"];

export function toKhmerNumber(value: number | string): string {
  return String(value).replace(/\d/g, (d) => KHMER_DIGITS[Number(d)]!);
}

export function generateAlbumsForFestival(f: Festival, allYears: number[] = STATIC_YEARS): Album[] {
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

export function albumPhotos(
  album: Album,
  poolCovers: string[] = STATIC_FESTIVALS.map((f) => f.cover),
) {
  return Array.from({ length: album.photoCount }, (_, i) => {
    const seed = hash(`${album.id}-${i}`);
    return {
      id: `${album.id}-${i}`,
      src: i % 3 === 0 ? album.festival.cover : poolCovers[seed % poolCovers.length]!,
      caption: `${album.festival.name} · រូបទី ${toKhmerNumber(i + 1)}`,
      tall: seed % 5 === 0,
    };
  });
}
