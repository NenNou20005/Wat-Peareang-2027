import chaulChnamCover from "@/assets/fest-chaul-chnam.jpg";
import visakCover from "@/assets/fest-visak.jpg";
import meakCover from "@/assets/fest-meak.jpg";
import cholVossaCover from "@/assets/fest-chol-vossa.jpg";
import chenhVossaCover from "@/assets/fest-chenh-vossa.jpg";
import pchumBenCover from "@/assets/fest-pchum-ben.jpg";
import kathinCover from "@/assets/fest-kathin.jpg";
import omToukCover from "@/assets/fest-om-touk.jpg";

export interface HierarchyPhoto {
  id: string;
  url: string;
  title: string;
  caption?: string;
  photographer?: string;
  dateTaken?: string;
}

export interface HierarchyAlbum {
  id: string;
  festivalId: string;
  festivalNameKh: string;
  year: number;
  eventId: string;
  eventNameKh: string;
  title: string;
  description?: string;
  location: string;
  date: string;
  coverImage: string;
  photoCount: number;
  viewsCount: number;
  likesCount: number;
  photos: HierarchyPhoto[];
}

export interface HierarchyEvent {
  id: string;
  festivalId: string;
  year: number;
  nameKh: string;
  nameEn?: string;
  description: string;
  date: string;
  location: string;
  icon: string;
  coverImage?: string;
  albums: HierarchyAlbum[];
  photoCount: number;
}

export interface HierarchyFestivalSummary {
  id: string;
  nameKh: string;
  nameEn: string;
  emoji: string;
  coverImage: string;
  accent: string;
  month: string;
  description: string;
  yearCount: number;
  eventCount: number;
  albumCount: number;
  photoCount: number;
  years: number[];
}

// ----------------------------------------------------------------------------
// Curated Cultural Photo Pools (Reusing archive imagery)
// ----------------------------------------------------------------------------
const PHOTO_BANK = [
  chaulChnamCover,
  visakCover,
  meakCover,
  cholVossaCover,
  chenhVossaCover,
  pchumBenCover,
  kathinCover,
  omToukCover,
];

function generateMockPhotos(baseId: string, count: number, eventName: string, albumTitle: string): HierarchyPhoto[] {
  return Array.from({ length: count }, (_, idx) => {
    const photoImg = PHOTO_BANK[(idx + baseId.length) % PHOTO_BANK.length] || chaulChnamCover;
    return {
      id: `${baseId}-photo-${idx + 1}`,
      url: photoImg,
      title: `${albumTitle} · រូបទី ${idx + 1}`,
      caption: `ទិដ្ឋភាពនៃ ${eventName} — ${albumTitle} (រូបថតទី ${idx + 1} វត្តពារាំង)`,
      photographer: "ក្រុមការងារបណ្ណសារវត្តពារាំង",
      dateTaken: "២០២៦",
    };
  });
}

// ----------------------------------------------------------------------------
// Detailed Hierarchy Dataset (Festival -> Year -> Events -> Albums -> Photos)
// ----------------------------------------------------------------------------

export const MOCK_HIERARCHY_DATA: Record<string, {
  nameKh: string;
  nameEn: string;
  emoji: string;
  coverImage: string;
  accent: string;
  month: string;
  description: string;
  years: number[];
  eventsByYear: Record<number, HierarchyEvent[]>;
}> = {
  "chaul-chnam": {
    nameKh: "បុណ្យចូលឆ្នាំខ្មែរ",
    nameEn: "Khmer New Year",
    emoji: "🕊️",
    coverImage: chaulChnamCover,
    accent: "var(--fest-newyear)",
    month: "មេសា",
    description: "ពិធីបុណ្យចូលឆ្នាំថ្មីប្រពៃណីជាតិខ្មែរ ជាឱកាសសិរីសួស្តី ជួបជុំគ្រួសារ ធ្វើបុណ្យទក្ខិណានុប្បទាន និងលេងល្បែងប្រជាប្រិយប្រពៃណីខ្មែរ។",
    years: [2026, 2025, 2024, 2023, 2022],
    eventsByYear: {
      2026: [
        {
          id: "cny-2026-sangkran",
          festivalId: "chaul-chnam",
          year: 2026,
          nameKh: "ថ្ងៃទី១ ៖ ពិធីទទួលទេវតាឆ្នាំថ្មី (មហាសង្ក្រាន្ត)",
          nameEn: "Day 1 — Moha Sangkran & New Year Welcome",
          date: "១៤ មេសា ២០២៦",
          location: "វត្តពារាំង (សាលាឆាន់ & មុខព្រះវិហារ)",
          icon: "🕊️",
          description: "ពិធីរៀបចំរណ្តាប់ទទួលទេវតាឆ្នាំថ្មី ព្រះនាមកិមិរាទេវី នមស្ការព្រះរតនត្រ័យ និងទទួលពរជ័យសិរីសួស្តីដល់ក្រុមគ្រួសារ។",
          coverImage: chaulChnamCover,
          photoCount: 48,
          albums: [
            {
              id: "alb-cny-2026-sangkran-morning",
              festivalId: "chaul-chnam",
              festivalNameKh: "បុណ្យចូលឆ្នាំខ្មែរ",
              year: 2026,
              eventId: "cny-2026-sangkran",
              eventNameKh: "ថ្ងៃទី១ ៖ ពិធីទទួលទេវតាឆ្នាំថ្មី (មហាសង្ក្រាន្ត)",
              title: "ពិធីរៀបចំរណ្តាប់ទេវតា និងពុទ្ធបរិស័ទជួបជុំពេលព្រឹក",
              description: "ពុទ្ធបរិស័ទចំណុះជើងវត្តពារាំងនាំយកគ្រឿងសក្ការៈ បូជាផ្កាភ្ញី ទៀនធូប និងរៀបចំជើងពានទទួលទេវតាឆ្នាំថ្មី។",
              location: "មុខព្រះវិហារវត្តពារាំង",
              date: "១៤ មេសា ២០២៦ (ព្រឹក)",
              coverImage: chaulChnamCover,
              photoCount: 20,
              viewsCount: 540,
              likesCount: 88,
              photos: generateMockPhotos("alb-cny-2026-sangkran-morning", 20, "ពិធីទទួលទេវតាឆ្នាំថ្មី", "ពិធីរៀបចំរណ្តាប់ទេវតា"),
            },
            {
              id: "alb-cny-2026-sangkran-ceremony",
              festivalId: "chaul-chnam",
              festivalNameKh: "បុណ្យចូលឆ្នាំខ្មែរ",
              year: 2026,
              eventId: "cny-2026-sangkran",
              eventNameKh: "ថ្ងៃទី១ ៖ ពិធីទទួលទេវតាឆ្នាំថ្មី (មហាសង្ក្រាន្ត)",
              title: "ពិធីសូត្រមន្តនមស្ការព្រះរតនត្រ័យ និងស្វាគមន៍ទេវតាថ្មី",
              description: "ព្រះសង្ឃវត្តពារាំងចម្រើនព្រះបរិត្ត សូត្រមន្តជយន្តោ និងប្រសិទ្ធពរជ័យសិរីមង្គលដល់ពុទ្ធបរិស័ទគ្រប់រូប។",
              location: "សាលាឆាន់វត្តពារាំង",
              date: "១៤ មេសា ២០២៦ (ថ្ងៃត្រង់)",
              coverImage: chaulChnamCover,
              photoCount: 16,
              viewsCount: 390,
              likesCount: 64,
              photos: generateMockPhotos("alb-cny-2026-sangkran-ceremony", 16, "ពិធីទទួលទេវតាឆ្នាំថ្មី", "ពិធីសូត្រមន្តនមស្ការ"),
            },
            {
              id: "alb-cny-2026-sangkran-games",
              festivalId: "chaul-chnam",
              festivalNameKh: "បុណ្យចូលឆ្នាំខ្មែរ",
              year: 2026,
              eventId: "cny-2026-sangkran",
              eventNameKh: "ថ្ងៃទី១ ៖ ពិធីទទួលទេវតាឆ្នាំថ្មី (មហាសង្ក្រាន្ត)",
              title: "សកម្មភាពលេងល្បែងប្រជាប្រិយខ្មែរពេលរសៀល",
              description: "យុវជន និងពុទ្ធបរិស័ទចូលរួមលេងល្បែងប្រជាប្រិយបុរាណ៖ ចោលឈូង ទាញព្រ័ត្រ លាក់កន្សែង និងរាំវង់សាមគ្គី។",
              location: "ទីធ្លាមុខព្រះវិហារ",
              date: "១៤ មេសា ២០២៦ (រសៀល)",
              coverImage: chaulChnamCover,
              photoCount: 12,
              viewsCount: 470,
              likesCount: 95,
              photos: generateMockPhotos("alb-cny-2026-sangkran-games", 12, "ពិធីទទួលទេវតាឆ្នាំថ្មី", "ល្បែងប្រជាប្រិយខ្មែរ"),
            },
          ],
        },
        {
          id: "cny-2026-wanabot",
          festivalId: "chaul-chnam",
          year: 2026,
          nameKh: "ថ្ងៃទី២ ៖ ពិធីពូនភ្នំខ្សាច់ & វារវ័ន",
          nameEn: "Day 2 — Wanabot & Sand Mountain Ceremony",
          date: "១៥ មេសា ២០២៦",
          location: "វត្តពារាំង (ជុំវិញព្រះចេតិយ & ព្រះវិហារ)",
          icon: "🌾",
          description: "ពិធីពូនភ្នំខ្សាច់ឧទ្ទិសកុសលដល់ព្រះចេតិយចូឡាមណី លាងបាបកម្មទាំងពួង និងពិធីចែកទានដល់ជនទីទ័លក្រ។",
          coverImage: chaulChnamCover,
          photoCount: 36,
          albums: [
            {
              id: "alb-cny-2026-sand-mountain",
              festivalId: "chaul-chnam",
              festivalNameKh: "បុណ្យចូលឆ្នាំខ្មែរ",
              year: 2026,
              eventId: "cny-2026-wanabot",
              eventNameKh: "ថ្ងៃទី២ ៖ ពិធីពូនភ្នំខ្សាច់ & វារវ័ន",
              title: "ពិធីពូនភ្នំខ្សាច់ជុំវិញព្រះវិហារ និងសាលាឆាន់",
              description: "ពុទ្ធបរិស័ទរួមសាមគ្គីពូនភ្នំខ្សាច់ជា ៥ ទិស បូជាផ្កា និងទង់ក្រដាសពណ៌ ដើម្បីឧទ្ទិសកុសលផលបុណ្យ។",
              location: "បរិវេណព្រះវិហារវត្តពារាំង",
              date: "១៥ មេសា ២០២៦ (ព្រឹក)",
              coverImage: chaulChnamCover,
              photoCount: 20,
              viewsCount: 360,
              likesCount: 72,
              photos: generateMockPhotos("alb-cny-2026-sand-mountain", 20, "ពិធីពូនភ្នំខ្សាច់", "ពិធីពូនភ្នំខ្សាច់ជុំវិញព្រះវិហារ"),
            },
            {
              id: "alb-cny-2026-bangskol-ancestors",
              festivalId: "chaul-chnam",
              festivalNameKh: "បុណ្យចូលឆ្នាំខ្មែរ",
              year: 2026,
              eventId: "cny-2026-wanabot",
              eventNameKh: "ថ្ងៃទី២ ៖ ពិធីពូនភ្នំខ្សាច់ & វារវ័ន",
              title: "ពិធីបង្សុកូលឧទ្ទិសកុសលដល់បុព្វការីជន",
              description: "ពិធីបង្សុកូលចេតិយ និងរាប់បាត្រឧទ្ទិសកុសលដល់មាតាបិតា ជីដូនជីតា និងញាតិកាទាំង ៧ សន្តានដែលបានចែកឋាន។",
              location: "ព្រះចេតិយបុរាណវត្តពារាំង",
              date: "១៥ មេសា ២០២៦ (រសៀល)",
              coverImage: chaulChnamCover,
              photoCount: 16,
              viewsCount: 310,
              likesCount: 58,
              photos: generateMockPhotos("alb-cny-2026-bangskol-ancestors", 16, "ពិធីពូនភ្នំខ្សាច់", "ពិធីបង្សុកូលឧទ្ទិសកុសល"),
            },
          ],
        },
        {
          id: "cny-2026-leungsak",
          festivalId: "chaul-chnam",
          year: 2026,
          nameKh: "ថ្ងៃទី៣ ៖ ពិធីស្រង់ព្រះ & ឡើងស័ក",
          nameEn: "Day 3 — Leung Sak & Bathing of the Buddha",
          date: "១៦ មេសា ២០២៦",
          location: "វត្តពារាំង (មហាសាលា & ព្រះវិហារ)",
          icon: "🪷",
          description: "ពិធីស្រង់ទឹកអប់ផ្កាលើព្រះពុទ្ធបដិមា ព្រះសង្ឃ និងឪពុកម្តាយ ដើម្បីសុំខមាទោស លាងជម្រះឧបទ្រពចង្រៃ និងទទួលពរជ័យឆ្នាំថ្មី។",
          coverImage: chaulChnamCover,
          photoCount: 52,
          albums: [
            {
              id: "alb-cny-2026-srang-buddha",
              festivalId: "chaul-chnam",
              festivalNameKh: "បុណ្យចូលឆ្នាំខ្មែរ",
              year: 2026,
              eventId: "cny-2026-leungsak",
              eventNameKh: "ថ្ងៃទី៣ ៖ ពិធីស្រង់ព្រះ & ឡើងស័ក",
              title: "ពិធីស្រង់ព្រះពុទ្ធបដិមា និងព្រះសង្ឃ",
              description: "ពិធីស្រង់ទឹកអប់ផ្កាលើព្រះពុទ្ធបដិមាធំ និងព្រះសង្ឃវត្តពារាំង ដើម្បីសុំសេចក្តីសុខសាន្តត្រជាក់ត្រជុំពេញមួយឆ្នាំ។",
              location: "មុខព្រះវិហារវត្តពារាំង",
              date: "១៦ មេសា ២០២៦ (ព្រឹក)",
              coverImage: chaulChnamCover,
              photoCount: 22,
              viewsCount: 680,
              likesCount: 124,
              photos: generateMockPhotos("alb-cny-2026-srang-buddha", 22, "ពិធីស្រង់ព្រះ", "ពិធីស្រង់ព្រះពុទ្ធបដិមា"),
            },
            {
              id: "alb-cny-2026-srang-parents",
              festivalId: "chaul-chnam",
              festivalNameKh: "បុណ្យចូលឆ្នាំខ្មែរ",
              year: 2026,
              eventId: "cny-2026-leungsak",
              eventNameKh: "ថ្ងៃទី៣ ៖ ពិធីស្រង់ព្រះ & ឡើងស័ក",
              title: "ពិធីស្រង់ទឹកមាតាបិតា និងចាស់ព្រឹទ្ធាចារ្យ",
              description: "កូនចៅនាំគ្នាស្រង់ទឹកអប់ជូនឪពុកម្តាយ ជីដូនជីតា បង្ហាញនូវកតញ្ញូតាធម៌ និងទទួលពរជ័យសិរីមង្គល។",
              location: "សាលាឆាន់វត្តពារាំង",
              date: "១៦ មេសា ២០២៦ (ថ្ងៃត្រង់)",
              coverImage: chaulChnamCover,
              photoCount: 18,
              viewsCount: 510,
              likesCount: 98,
              photos: generateMockPhotos("alb-cny-2026-srang-parents", 18, "ពិធីស្រង់ព្រះ", "ពិធីស្រង់ទឹកមាតាបិតា"),
            },
            {
              id: "alb-cny-2026-closing-alms",
              festivalId: "chaul-chnam",
              festivalNameKh: "បុណ្យចូលឆ្នាំខ្មែរ",
              year: 2026,
              eventId: "cny-2026-leungsak",
              eventNameKh: "ថ្ងៃទី៣ ៖ ពិធីស្រង់ព្រះ & ឡើងស័ក",
              title: "ពិធីរាប់បាត្រ និងឆ្លងបុណ្យចូលឆ្នាំថ្មី",
              description: "ពិធីរាប់បាត្រឆ្លងបុណ្យចូលឆ្នាំថ្មី និងផ្សាយមេត្តាចិត្តដល់សព្វសត្វទូទាំងចក្រវាឡ។",
              location: "ទីធ្លាវត្តពារាំង",
              date: "១៦ មេសា ២០២៦ (រសៀល)",
              coverImage: chaulChnamCover,
              photoCount: 12,
              viewsCount: 390,
              likesCount: 67,
              photos: generateMockPhotos("alb-cny-2026-closing-alms", 12, "ពិធីស្រង់ព្រះ", "ពិធីរាប់បាត្រឆ្លងបុណ្យ"),
            },
          ],
        },
      ],
      2025: [
        {
          id: "cny-2025-sangkran",
          festivalId: "chaul-chnam",
          year: 2025,
          nameKh: "ថ្ងៃទី១ ៖ ពិធីទទួលទេវតាឆ្នាំថ្មី (មហាសង្ក្រាន្ត ២០២៥)",
          nameEn: "Day 1 — Moha Sangkran 2025",
          date: "១៤ មេសា ២០២៥",
          location: "វត្តពារាំង",
          icon: "🕊️",
          description: "ទិដ្ឋភាពពិធីទទួលទេវតាឆ្នាំថ្មីប្រចាំឆ្នាំ ២០២៥ នៅវត្តពារាំង។",
          coverImage: chaulChnamCover,
          photoCount: 30,
          albums: [
            {
              id: "alb-cny-2025-sangkran-highlights",
              festivalId: "chaul-chnam",
              festivalNameKh: "បុណ្យចូលឆ្នាំខ្មែរ",
              year: 2025,
              eventId: "cny-2025-sangkran",
              eventNameKh: "ថ្ងៃទី១ ៖ ពិធីទទួលទេវតាឆ្នាំថ្មី (មហាសង្ក្រាន្ត ២០២៥)",
              title: "កម្រងរូបភាពពិធីទទួលទេវតាឆ្នាំថ្មី ២០២៥",
              description: "រូបភាពពិធីទទួលទេវតាឆ្នាំថ្មី និងការចូលរួមរបស់ពុទ្ធបរិស័ទ។",
              location: "វត្តពារាំង",
              date: "១៤ មេសា ២០២៥",
              coverImage: chaulChnamCover,
              photoCount: 30,
              viewsCount: 410,
              likesCount: 65,
              photos: generateMockPhotos("alb-cny-2025-sangkran-highlights", 30, "ពិធីទទួលទេវតា ២០២៥", "កម្រងរូបភាពទូទៅ"),
            },
          ],
        },
        {
          id: "cny-2025-leungsak",
          festivalId: "chaul-chnam",
          year: 2025,
          nameKh: "ថ្ងៃទី៣ ៖ ពិធីស្រង់ព្រះ & ឡើងស័ក ២០២៥",
          nameEn: "Day 3 — Leung Sak 2025",
          date: "១៦ មេសា ២០២៥",
          location: "វត្តពារាំង",
          icon: "🪷",
          description: "ពិធីស្រង់ព្រះ និងស្រង់ទឹកមាតាបិតាប្រចាំឆ្នាំ ២០២៥។",
          coverImage: chaulChnamCover,
          photoCount: 28,
          albums: [
            {
              id: "alb-cny-2025-srang-highlights",
              festivalId: "chaul-chnam",
              festivalNameKh: "បុណ្យចូលឆ្នាំខ្មែរ",
              year: 2025,
              eventId: "cny-2025-leungsak",
              eventNameKh: "ថ្ងៃទី៣ ៖ ពិធីស្រង់ព្រះ & ឡើងស័ក ២០២៥",
              title: "កម្រងរូបភាពពិធីស្រង់ព្រះ និងស្រង់ទឹកមាតាបិតា ២០២៥",
              description: "ទិដ្ឋភាពស្រង់ព្រះពុទ្ធបដិមា និងព្រះសង្ឃវត្តពារាំង។",
              location: "វត្តពារាំង",
              date: "១៦ មេសា ២០២៥",
              coverImage: chaulChnamCover,
              photoCount: 28,
              viewsCount: 380,
              likesCount: 59,
              photos: generateMockPhotos("alb-cny-2025-srang-highlights", 28, "ពិធីស្រង់ព្រះ ២០២៥", "កម្រងរូបភាពស្រង់ព្រះ"),
            },
          ],
        },
      ],
      2024: [
        {
          id: "cny-2024-full",
          festivalId: "chaul-chnam",
          year: 2024,
          nameKh: "មហាសង្ក្រាន្ត និងស្រង់ព្រះ ២០២៤",
          nameEn: "Moha Sangkran & Bathing 2024",
          date: "១៤–១៦ មេសា ២០២៤",
          location: "វត្តពារាំង",
          icon: "🕊️",
          description: "កម្រងរូបភាពប្រចាំឆ្នាំ ២០២៤ នៃពិធីបុណ្យចូលឆ្នាំខ្មែរវត្តពារាំង។",
          coverImage: chaulChnamCover,
          photoCount: 35,
          albums: [
            {
              id: "alb-cny-2024-archive",
              festivalId: "chaul-chnam",
              festivalNameKh: "បុណ្យចូលឆ្នាំខ្មែរ",
              year: 2024,
              eventId: "cny-2024-full",
              eventNameKh: "មហាសង្ក្រាន្ត និងស្រង់ព្រះ ២០២៤",
              title: "បណ្ណសាររូបភាពបុណ្យចូលឆ្នាំថ្មី ២០២៤",
              description: "រូបភាពបុណ្យចូលឆ្នាំខ្មែរប្រចាំឆ្នាំ ២០២៤ វត្តពារាំង។",
              location: "វត្តពារាំង",
              date: "១៤–១៦ មេសា ២០២៤",
              coverImage: chaulChnamCover,
              photoCount: 35,
              viewsCount: 520,
              likesCount: 78,
              photos: generateMockPhotos("alb-cny-2024-archive", 35, "បុណ្យចូលឆ្នាំ ២០២៤", "បណ្ណសាររូបភាព"),
            },
          ],
        },
      ],
    },
  },

  "pchum-ben": {
    nameKh: "បុណ្យភ្ជុំបិណ្ឌ",
    nameEn: "Pchum Ben Festival",
    emoji: "🌾",
    coverImage: pchumBenCover,
    accent: "var(--fest-pchumben)",
    month: "កញ្ញា/តុលា",
    description: "ពិធីបុណ្យកាន់បិណ្ឌ និងភ្ជុំបិណ្ឌ ជាបុណ្យប្រពៃណីដ៏ធំរបស់ពុទ្ធសាសនិកខ្មែរ ដើម្បីឧទ្ទិសកុសលជូនបុព្វការីជន និងញាតិកាទាំង ៧ សន្តាន។",
    years: [2026, 2025, 2024, 2023],
    eventsByYear: {
      2026: [
        {
          id: "pb-2026-kan-ben",
          festivalId: "pchum-ben",
          year: 2026,
          nameKh: "ពិធីកាន់បិណ្ឌទី១ ដល់បិណ្ឌទី១៤",
          nameEn: "Kan Ben Ceremonies (Days 1–14)",
          date: "កញ្ញា ២០២៦",
          location: "សាលាឆាន់វត្តពារាំង",
          icon: "🕯️",
          description: "ពុទ្ធបរិស័ទចំណុះជើងវត្តផ្លាស់វេនគ្នាកាន់បិណ្ឌ រៀបចំចង្ហាន់ ស្ដាប់ធម៌ទេសនា និងសូត្រធម៌បរាភវសូត្រ។",
          coverImage: pchumBenCover,
          photoCount: 42,
          albums: [
            {
              id: "alb-pb-2026-kan-ben-chants",
              festivalId: "pchum-ben",
              festivalNameKh: "បុណ្យភ្ជុំបិណ្ឌ",
              year: 2026,
              eventId: "pb-2026-kan-ben",
              eventNameKh: "ពិធីកាន់បិណ្ឌទី១ ដល់បិណ្ឌទី១៤",
              title: "ពិធីសូត្រធម៌បរាភវសូត្រ និងស្តាប់ព្រះធម៌ទេសនា",
              description: "បរិយាកាសស្ងប់ស្ងាត់ និងសទ្ធាជ្រះថ្លានៃការពុទ្ធបរិស័ទស្តាប់ព្រះធម៌ទេសនាក្នុងរាត្រីកាន់បិណ្ឌ។",
              location: "សាលាឆាន់វត្តពារាំង",
              date: "កញ្ញា ២០២៦ (យប់)",
              coverImage: pchumBenCover,
              photoCount: 22,
              viewsCount: 380,
              likesCount: 71,
              photos: generateMockPhotos("alb-pb-2026-kan-ben-chants", 22, "ពិធីកាន់បិណ្ឌ", "ពិធីសូត្រធម៌"),
            },
            {
              id: "alb-pb-2026-kan-ben-food",
              festivalId: "pchum-ben",
              festivalNameKh: "បុណ្យភ្ជុំបិណ្ឌ",
              year: 2026,
              eventId: "pb-2026-kan-ben",
              eventNameKh: "ពិធីកាន់បិណ្ឌទី១ ដល់បិណ្ឌទី១៤",
              title: "ពិធីរៀបចំចង្ហាន់ និងរាប់បាត្រពេលព្រឹក",
              description: "ពុទ្ធបរិស័ទវេនបិណ្ឌរៀបចំបាយសម្ល និងនំអន្សមប្រគេនព្រះសង្ឃ។",
              location: "វត្តពារាំង",
              date: "កញ្ញា ២០២៦ (ព្រឹក)",
              coverImage: pchumBenCover,
              photoCount: 20,
              viewsCount: 320,
              likesCount: 54,
              photos: generateMockPhotos("alb-pb-2026-kan-ben-food", 20, "ពិធីកាន់បិណ្ឌ", "ពិធីរៀបចំចង្ហាន់"),
            },
          ],
        },
        {
          id: "pb-2026-bos-bay-ben",
          festivalId: "pchum-ben",
          year: 2026,
          nameKh: "ពិធីបោះបាយបិណ្ឌទៀបភ្លឺ",
          nameEn: "Bos Bay Ben at Dawn",
          date: "កញ្ញា ២០២៦ (វេលាម៉ោង ៤ ទៀបភ្លឺ)",
          location: "ជុំវិញព្រះវិហារវត្តពារាំង",
          icon: "🌙",
          description: "ពិធីបោះបាយបិណ្ឌនៅវេលាម៉ោង ៤ ទៀបភ្លឺ ដើម្បីឧទ្ទិសដល់ពពួកប្រេត និងអសុរកាយដែលរង់ចាំទទួលកុសល។",
          coverImage: pchumBenCover,
          photoCount: 28,
          albums: [
            {
              id: "alb-pb-2026-bos-bay-dawn",
              festivalId: "pchum-ben",
              festivalNameKh: "បុណ្យភ្ជុំបិណ្ឌ",
              year: 2026,
              eventId: "pb-2026-bos-bay-ben",
              eventNameKh: "ពិធីបោះបាយបិណ្ឌទៀបភ្លឺ",
              title: "សកម្មភាពពុទ្ធបរិស័ទដើរប្រទក្សិណ និងបោះបាយបិណ្ឌ",
              description: "ទិដ្ឋភាពកាន់ចន្លុះ ទៀនធូប និងដើរប្រទក្សិណ ៣ ជុំព្រះវិហារវត្តពារាំង។",
              location: "ជុំវិញព្រះវិហារវត្តពារាំង",
              date: "កញ្ញា ២០២៦ (ទៀបភ្លឺ)",
              coverImage: pchumBenCover,
              photoCount: 28,
              viewsCount: 490,
              likesCount: 92,
              photos: generateMockPhotos("alb-pb-2026-bos-bay-dawn", 28, "ពិធីបោះបាយបិណ្ឌ", "ដើរប្រទក្សិណបោះបាយបិណ្ឌ"),
            },
          ],
        },
        {
          id: "pb-2026-main-day",
          festivalId: "pchum-ben",
          year: 2026,
          nameKh: "ទិវាបុណ្យភ្ជុំបិណ្ឌធំ & ពិធីដារឆ្លង",
          nameEn: "Great Pchum Ben Day & Final Offering",
          date: "តុលា ២០២៦ (ថ្ងៃ ១៥ រោច)",
          location: "វត្តពារាំង",
          icon: "🪷",
          description: "ទិវាបុណ្យភ្ជុំបិណ្ឌធំ ពុទ្ធបរិស័ទមកពីគ្រប់ទិសទីជួបជុំគ្នាធ្វើបុណ្យឆ្លង និងលែងសំពៅបាយបិណ្ឌ។",
          coverImage: pchumBenCover,
          photoCount: 50,
          albums: [
            {
              id: "alb-pb-2026-main-gathering",
              festivalId: "pchum-ben",
              festivalNameKh: "បុណ្យភ្ជុំបិណ្ឌ",
              year: 2026,
              eventId: "pb-2026-main-day",
              eventNameKh: "ទិវាបុណ្យភ្ជុំបិណ្ឌធំ & ពិធីដារឆ្លង",
              title: "មហាសន្និបាតពុទ្ធបរិស័ទ និងពិធីរាប់បាត្រធំ",
              description: "ពុទ្ធបរិស័ទរាប់ពាន់នាក់ចូលរួមរាប់បាត្រ និងថ្វាយបង្គំព្រះសង្ឃក្នុងទិវាភ្ជុំបិណ្ឌធំ។",
              location: "សាលាឆាន់ & ទីធ្លាវត្តពារាំង",
              date: "តុលា ២០២៦ (ព្រឹក)",
              coverImage: pchumBenCover,
              photoCount: 30,
              viewsCount: 720,
              likesCount: 140,
              photos: generateMockPhotos("alb-pb-2026-main-gathering", 30, "ទិវាភ្ជុំបិណ្ឌធំ", "មហាសន្និបាតពុទ្ធបរិស័ទ"),
            },
            {
              id: "alb-pb-2026-boat-release",
              festivalId: "pchum-ben",
              festivalNameKh: "បុណ្យភ្ជុំបិណ្ឌ",
              year: 2026,
              eventId: "pb-2026-main-day",
              eventNameKh: "ទិវាបុណ្យភ្ជុំបិណ្ឌធំ & ពិធីដារឆ្លង",
              title: "ពិធីលែងសំពៅបាយបិណ្ឌ និងបណ្តែតក្បូន",
              description: "ពិធីបណ្តែតសំពៅបាយបិណ្ឌធ្វើអំពីដើមចេក ដើម្បីជូនដំណើរវិញ្ញាណក្ខន្ធបុព្វការីជន។",
              location: "ស្រះទឹកបុរាណវត្តពារាំង",
              date: "តុលា ២០២៦ (រសៀល)",
              coverImage: pchumBenCover,
              photoCount: 20,
              viewsCount: 450,
              likesCount: 82,
              photos: generateMockPhotos("alb-pb-2026-boat-release", 20, "ទិវាភ្ជុំបិណ្ឌធំ", "ពិធីលែងសំពៅបាយបិណ្ឌ"),
            },
          ],
        },
      ],
      2025: [
        {
          id: "pb-2025-main",
          festivalId: "pchum-ben",
          year: 2025,
          nameKh: "បុណ្យភ្ជុំបិណ្ឌធំ ២០២៥",
          nameEn: "Pchum Ben Main Day 2025",
          date: "តុលា ២០២៥",
          location: "វត្តពារាំង",
          icon: "🌾",
          description: "កម្រងរូបភាពទិវាបុណ្យភ្ជុំបិណ្ឌប្រចាំឆ្នាំ ២០២៥។",
          coverImage: pchumBenCover,
          photoCount: 35,
          albums: [
            {
              id: "alb-pb-2025-archive",
              festivalId: "pchum-ben",
              festivalNameKh: "បុណ្យភ្ជុំបិណ្ឌ",
              year: 2025,
              eventId: "pb-2025-main",
              eventNameKh: "បុណ្យភ្ជុំបិណ្ឌធំ ២០២៥",
              title: "បណ្ណសាររូបភាពភ្ជុំបិណ្ឌ ២០២៥",
              description: "រូបភាពពិធីភ្ជុំបិណ្ឌប្រចាំឆ្នាំ ២០២៥ វត្តពារាំង។",
              location: "វត្តពារាំង",
              date: "តុលា ២០២៥",
              coverImage: pchumBenCover,
              photoCount: 35,
              viewsCount: 390,
              likesCount: 62,
              photos: generateMockPhotos("alb-pb-2025-archive", 35, "ភ្ជុំបិណ្ឌ ២០២៥", "បណ្ណសាររូបភាព"),
            },
          ],
        },
      ],
    },
  },

  "kathin": {
    nameKh: "បុណ្យកឋិនទាន",
    nameEn: "Kathina Festival",
    emoji: "🕊️",
    coverImage: kathinCover,
    accent: "var(--fest-kathin)",
    month: "តុលា/វិច្ឆិកា",
    description: "កាលទានដ៏វិសេសវិសាលក្នុងព្រះពុទ្ធសាសនា ដែលពុទ្ធបរិស័ទដង្ហែត្រៃចីវរប្រគេនព្រះសង្ឃដែលបានគង់ចាំវស្សាអស់ត្រីមាស។",
    years: [2026, 2025, 2024],
    eventsByYear: {
      2026: [
        {
          id: "kt-2026-procession",
          festivalId: "kathin",
          year: 2026,
          nameKh: "ពិធីក្រុងពាលី & ដង្ហែអង្គកឋិនទាន",
          nameEn: "Kathina Robe Procession",
          date: "តុលា ២០២៦",
          location: "បរិវេណវត្តពារាំង",
          icon: "🥁",
          description: "ពិធីដង្ហែអង្គកឋិនទាន និងត្រៃចីវរប្រទក្សិណ ៣ ជុំព្រះវិហារវត្តពារាំង អមដោយភ្លេងឆៃយ៉ាំ និងក្បួនដង្ហែយ៉ាងគគ្រឹកគគ្រេង។",
          coverImage: kathinCover,
          photoCount: 40,
          albums: [
            {
              id: "alb-kt-2026-parade",
              festivalId: "kathin",
              festivalNameKh: "បុណ្យកឋិនទាន",
              year: 2026,
              eventId: "kt-2026-procession",
              eventNameKh: "ពិធីក្រុងពាលី & ដង្ហែអង្គកឋិនទាន",
              title: "ក្បួនដង្ហែត្រៃចីវរ និងភ្លេងឆៃយ៉ាំជុំវិញព្រះវិហារ",
              description: "ទិដ្ឋភាពក្បួនដង្ហែអង្គកឋិនទានរបស់ម្ចាស់ទាន និងពុទ្ធបរិស័ទយ៉ាងសប្បាយរីករាយ។",
              location: "ជុំវិញព្រះវិហារវត្តពារាំង",
              date: "តុលា ២០២៦",
              coverImage: kathinCover,
              photoCount: 22,
              viewsCount: 460,
              likesCount: 88,
              photos: generateMockPhotos("alb-kt-2026-parade", 22, "ដង្ហែអង្គកឋិនទាន", "ក្បួនដង្ហែត្រៃចីវរ"),
            },
            {
              id: "alb-kt-2026-offerings",
              festivalId: "kathin",
              festivalNameKh: "បុណ្យកឋិនទាន",
              year: 2026,
              eventId: "kt-2026-procession",
              eventNameKh: "ពិធីក្រុងពាលី & ដង្ហែអង្គកឋិនទាន",
              title: "គ្រឿងបរិក្ខារ និងបរិវារកឋិនទាន",
              description: "ការរៀបចំគ្រឿងបរិក្ខារ ស្បង់ ចីវរ សង្ឃាដី និងបច្ច័យបួនសម្រាប់ប្រគេនព្រះសង្ឃ។",
              location: "សាលាឆាន់វត្តពារាំង",
              date: "តុលា ២០២៦",
              coverImage: kathinCover,
              photoCount: 18,
              viewsCount: 310,
              likesCount: 52,
              photos: generateMockPhotos("alb-kt-2026-offerings", 18, "ដង្ហែអង្គកឋិនទាន", "គ្រឿងបរិក្ខារកឋិនទាន"),
            },
          ],
        },
        {
          id: "kt-2026-ceremony",
          festivalId: "kathin",
          year: 2026,
          nameKh: "ពិធីវេរអង្គកឋិនទាន & ក្រាលគ្រង",
          nameEn: "Kathina Offering & Robe Robing",
          date: "តុលា ២០២៦",
          location: "ក្នុងព្រះវិហារវត្តពារាំង",
          icon: "🪷",
          description: "ពិធីវេរអង្គកឋិនទានប្រគេនសង្ឃ និងពិធីក្រាលគ្រងអង្គកឋិនទានរបស់ព្រះសង្ឃក្នុងសីមា។",
          coverImage: kathinCover,
          photoCount: 30,
          albums: [
            {
              id: "alb-kt-2026-simagran",
              festivalId: "kathin",
              festivalNameKh: "បុណ្យកឋិនទាន",
              year: 2026,
              eventId: "kt-2026-ceremony",
              eventNameKh: "ពិធីវេរអង្គកឋិនទាន & ក្រាលគ្រង",
              title: "ពិធីវេរត្រៃចីវរ និងសង្ឃកម្មក្នុងព្រះវិហារ",
              description: "ព្រះសង្ឃធ្វើសង្ឃកម្មញត្តិទុតិយកម្មវាចាក្រាលគ្រងអង្គកឋិនទានក្នុងព្រះវិហារ។",
              location: "ព្រះវិហារវត្តពារាំង",
              date: "តុលា ២០២៦",
              coverImage: kathinCover,
              photoCount: 30,
              viewsCount: 520,
              likesCount: 104,
              photos: generateMockPhotos("alb-kt-2026-simagran", 30, "ពិធីវេរកឋិនទាន", "ពិធីសង្ឃកម្ម"),
            },
          ],
        },
      ],
      2025: [
        {
          id: "kt-2025-full",
          festivalId: "kathin",
          year: 2025,
          nameKh: "បុណ្យកឋិនទានសាមគ្គី ២០២៥",
          nameEn: "Samaki Kathina 2025",
          date: "វិច្ឆិកា ២០២៥",
          location: "វត្តពារាំង",
          icon: "🕊️",
          description: "កម្រងរូបភាពពិធីបុណ្យកឋិនទានសាមគ្គីប្រចាំឆ្នាំ ២០២៥ វត្តពារាំង។",
          coverImage: kathinCover,
          photoCount: 32,
          albums: [
            {
              id: "alb-kt-2025-archive",
              festivalId: "kathin",
              festivalNameKh: "បុណ្យកឋិនទាន",
              year: 2025,
              eventId: "kt-2025-full",
              eventNameKh: "បុណ្យកឋិនទានសាមគ្គី ២០២៥",
              title: "បណ្ណសាររូបភាពកឋិនទាន ២០២៥",
              description: "រូបភាពបុណ្យកឋិនទានប្រចាំឆ្នាំ ២០២៥ វត្តពារាំង។",
              location: "វត្តពារាំង",
              date: "វិច្ឆិកា ២០២៥",
              coverImage: kathinCover,
              photoCount: 32,
              viewsCount: 360,
              likesCount: 68,
              photos: generateMockPhotos("alb-kt-2025-archive", 32, "កឋិនទាន ២០២៥", "បណ្ណសាររូបភាព"),
            },
          ],
        },
      ],
    },
  },

  "visak-bochea": {
    nameKh: "បុណ្យវិសាខបូជា",
    nameEn: "Visak Bochea Festival",
    emoji: "🛕",
    coverImage: visakCover,
    accent: "var(--fest-visak)",
    month: "ឧសភា",
    description: "បុណ្យរំលឹកដល់ព្រឹត្តិការណ៍ដ៏មហាសាលទាំង ៣ នៃព្រះសម្មាសម្ពុទ្ធ៖ ទ្រង់ប្រសូត ទ្រង់ត្រាស់ដឹង និងទ្រង់ចូលបរិនិព្វាន។",
    years: [2026, 2025, 2024],
    eventsByYear: {
      2026: [
        {
          id: "vb-2026-lantern",
          festivalId: "visak-bochea",
          year: 2026,
          nameKh: "ពិធីបូជាប្រទីបជ្វាលា & ដើរប្រទក្សិណ",
          nameEn: "Candlelight Procession & Dharma Talk",
          date: "ឧសភា ២០២៦",
          location: "វត្តពារាំង",
          icon: "🕯️",
          description: "ពិធីបូជាទៀន ធូប ផ្កាឈូក និងដើរប្រទក្សិណ ៣ ជុំព្រះវិហារ ដើម្បីគោរពបូជាដល់ព្រះសម្មាសម្ពុទ្ធ។",
          coverImage: visakCover,
          photoCount: 34,
          albums: [
            {
              id: "alb-vb-2026-candles",
              festivalId: "visak-bochea",
              festivalNameKh: "បុណ្យវិសាខបូជា",
              year: 2026,
              eventId: "vb-2026-lantern",
              eventNameKh: "ពិធីបូជាប្រទីបជ្វាលា & ដើរប្រទក្សិណ",
              title: "កម្រងរូបភាពរាត្រីប្រទីបជ្វាលា និងប្រទក្សិណ",
              description: "ទិដ្ឋភាពពន្លឺទៀនរាប់ពាន់បំភ្លឺព្រះវិហារវត្តពារាំងក្នុងរាត្រីវិសាខបូជា។",
              location: "ព្រះវិហារវត្តពារាំង",
              date: "ឧសភា ២០២៦",
              coverImage: visakCover,
              photoCount: 34,
              viewsCount: 480,
              likesCount: 95,
              photos: generateMockPhotos("alb-vb-2026-candles", 34, "ពិធីវិសាខបូជា", "រាត្រីប្រទីបជ្វាលា"),
            },
          ],
        },
      ],
    },
  },

  "meak-bochea": {
    nameKh: "បុណ្យមាឃបូជា",
    nameEn: "Meak Bochea Festival",
    emoji: "🕯️",
    coverImage: meakCover,
    accent: "var(--fest-meak)",
    month: "កុម្ភៈ",
    description: "បុណ្យរំលឹកដល់ចតុរង្គសន្និបាត ដែលព្រះសម្មាសម្ពុទ្ធទ្រង់សម្តែង «ឱវាទបាតិមោក្ខ» ដល់ព្រះភិក្ខុសង្ឃចំនួន ១,២៥០ អង្គ។",
    years: [2026, 2025, 2024],
    eventsByYear: {
      2026: [
        {
          id: "mb-2026-ovada",
          festivalId: "meak-bochea",
          year: 2026,
          nameKh: "ពិធីសូត្រឱវាទបាតិមោក្ខ & នមស្ការ",
          nameEn: "Ovada Patimokkha Recitation",
          date: "កុម្ភៈ ២០២៦",
          location: "វត្តពារាំង",
          icon: "✨",
          description: "ពិធីនមស្ការ និងសូត្រឱវាទបាតិមោក្ខក្នុងរាត្រីពេញបូណ៌មីខែមាឃ។",
          coverImage: meakCover,
          photoCount: 26,
          albums: [
            {
              id: "alb-mb-2026-night",
              festivalId: "meak-bochea",
              festivalNameKh: "បុណ្យមាឃបូជា",
              year: 2026,
              eventId: "mb-2026-ovada",
              eventNameKh: "ពិធីសូត្រឱវាទបាតិមោក្ខ & នមស្ការ",
              title: "កម្រងរូបភាពរាត្រីមាឃបូជា វត្តពារាំង",
              description: "ទិដ្ឋភាពពិធីសូត្រឱវាទបាតិមោក្ខ និងការបូជាប្រទីប។",
              location: "ព្រះវិហារវត្តពារាំង",
              date: "កុម្ភៈ ២០២៦",
              coverImage: meakCover,
              photoCount: 26,
              viewsCount: 350,
              likesCount: 60,
              photos: generateMockPhotos("alb-mb-2026-night", 26, "ពិធីមាឃបូជា", "រាត្រីមាឃបូជា"),
            },
          ],
        },
      ],
    },
  },

  "om-touk": {
    nameKh: "បុណ្យអុំទូក",
    nameEn: "Water Festival (Bon Om Touk)",
    emoji: "🚣",
    coverImage: omToukCover,
    accent: "var(--fest-omtouk)",
    month: "វិច្ឆិកា",
    description: "ព្រះរាជពិធីបុណ្យអុំទូក បណ្តែតប្រទីប និងសំពះព្រះខែ អកអំបុក ជាការរំលឹកគុណកងទ័ពជើងទឹក និងព្រះគង្គា។",
    years: [2026, 2025, 2024],
    eventsByYear: {
      2026: [
        {
          id: "ot-2026-boat-race",
          festivalId: "om-touk",
          year: 2026,
          nameKh: "ពិធីប្រណាំងទូក & សំពះព្រះខែ អកអំបុក",
          nameEn: "Boat Racing & Moon Salutation",
          date: "វិច្ឆិកា ២០២៦",
          location: "មាត់ស្ទឹង/ស្រះវត្តពារាំង",
          icon: "🚣",
          description: "ពិធីប្រណាំងទូកងសាមគ្គី និងពិធីសំពះព្រះខែ អកអំបុក បណ្តែតប្រទីបពេលរាត្រី។",
          coverImage: omToukCover,
          photoCount: 38,
          albums: [
            {
              id: "alb-ot-2026-moon-ak-ambok",
              festivalId: "om-touk",
              festivalNameKh: "បុណ្យអុំទូក",
              year: 2026,
              eventId: "ot-2026-boat-race",
              eventNameKh: "ពិធីប្រណាំងទូក & សំពះព្រះខែ អកអំបុក",
              title: "ពិធីសំពះព្រះខែ អកអំបុក និងបណ្តែតប្រទីប",
              description: "ពុទ្ធបរិស័ទជួបជុំសំពះព្រះខែ អកអំបុកចេកទុំ និងបណ្តែតប្រទីបបំភ្លឺផ្ទៃទឹក។",
              location: "វត្តពារាំង",
              date: "វិច្ឆិកា ២០២៦",
              coverImage: omToukCover,
              photoCount: 38,
              viewsCount: 560,
              likesCount: 110,
              photos: generateMockPhotos("alb-ot-2026-moon-ak-ambok", 38, "បុណ្យអុំទូក", "សំពះព្រះខែ អកអំបុក"),
            },
          ],
        },
      ],
    },
  },

  "chol-vossa": {
    nameKh: "បុណ្យចូលវស្សា",
    nameEn: "Chol Vossa (Rain Retreat)",
    emoji: "🌾",
    coverImage: cholVossaCover,
    accent: "var(--fest-cholvossa)",
    month: "កក្កដា",
    description: "ពិធីបុណ្យចូលកាន់ព្រះវស្សារបស់ព្រះសង្ឃរយៈពេល ៣ ខែ និងពិធីដង្ហែទៀនវស្សាប្រគេនវត្តអារាម។",
    years: [2026, 2025, 2024],
    eventsByYear: {
      2026: [
        {
          id: "cv-2026-candles",
          festivalId: "chol-vossa",
          year: 2026,
          nameKh: "ពិធីដង្ហែទៀនវស្សា & ថ្វាយប្រេងកាត",
          nameEn: "Rain Candle Procession & Offering",
          date: "កក្កដា ២០២៦",
          location: "វត្តពារាំង",
          icon: "🕯️",
          description: "ពិធីដង្ហែទៀនព្រះវស្សា ស្បង់សាដក និងប្រេងកាតប្រគេនព្រះសង្ឃគង់ចាំវស្សា។",
          coverImage: cholVossaCover,
          photoCount: 24,
          albums: [
            {
              id: "alb-cv-2026-candle-parade",
              festivalId: "chol-vossa",
              festivalNameKh: "បុណ្យចូលវស្សា",
              year: 2026,
              eventId: "cv-2026-candles",
              eventNameKh: "ពិធីដង្ហែទៀនវស្សា & ថ្វាយប្រេងកាត",
              title: "កម្រងរូបភាពពិធីដង្ហែទៀនព្រះវស្សា",
              description: "ក្បួនដង្ហែទៀនវស្សា និងត្រៃចីវរប្រគេនព្រះសង្ឃវត្តពារាំង។",
              location: "វត្តពារាំង",
              date: "កក្កដា ២០២៦",
              coverImage: cholVossaCover,
              photoCount: 24,
              viewsCount: 290,
              likesCount: 48,
              photos: generateMockPhotos("alb-cv-2026-candle-parade", 24, "បុណ្យចូលវស្សា", "ដង្ហែទៀនវស្សា"),
            },
          ],
        },
      ],
    },
  },

  "chenh-vossa": {
    nameKh: "បុណ្យចេញវស្សា",
    nameEn: "Chenh Vossa (End of Retreat)",
    emoji: "🪷",
    coverImage: chenhVossaCover,
    accent: "var(--fest-chenhvossa)",
    month: "តុលា",
    description: "ពិធីបុណ្យចេញព្រះវស្សា ពិធីបវារណា និងពិធីបណ្តែតប្រទីបលើផ្ទៃទឹក។",
    years: [2026, 2025, 2024],
    eventsByYear: {
      2026: [
        {
          id: "chv-2026-pavarana",
          festivalId: "chenh-vossa",
          year: 2026,
          nameKh: "ពិធីបវារណា & បណ្តែតប្រទីប",
          nameEn: "Pavarana Ceremony & Floating Lanterns",
          date: "តុលា ២០២៦",
          location: "វត្តពារាំង",
          icon: "🪷",
          description: "ពិធីសង្ឃកម្មបវារណា និងពិធីបណ្តែតប្រទីបកម្សាន្តរបស់ពុទ្ធបរិស័ទ។",
          coverImage: chenhVossaCover,
          photoCount: 25,
          albums: [
            {
              id: "alb-chv-2026-lanterns",
              festivalId: "chenh-vossa",
              festivalNameKh: "បុណ្យចេញវស្សា",
              year: 2026,
              eventId: "chv-2026-pavarana",
              eventNameKh: "ពិធីបវារណា & បណ្តែតប្រទីប",
              title: "កម្រងរូបភាពរាត្រីចេញវស្សា និងបណ្តែតប្រទីប",
              description: "ទិដ្ឋភាពពិធីចេញវស្សា និងពន្លឺប្រទីបបណ្តែតលើផ្ទៃស្រះវត្តពារាំង។",
              location: "វត្តពារាំង",
              date: "តុលា ២០២៦",
              coverImage: chenhVossaCover,
              photoCount: 25,
              viewsCount: 310,
              likesCount: 55,
              photos: generateMockPhotos("alb-chv-2026-lanterns", 25, "បុណ្យចេញវស្សា", "បណ្តែតប្រទីប"),
            },
          ],
        },
      ],
    },
  },
};

// ----------------------------------------------------------------------------
// Public Query Helpers for UI Prototype
// ----------------------------------------------------------------------------

export function getMockFestivalsSummary(): HierarchyFestivalSummary[] {
  return Object.entries(MOCK_HIERARCHY_DATA).map(([id, item]) => {
    const allEvents = Object.values(item.eventsByYear).flat();
    const allAlbums = allEvents.flatMap((e) => e.albums);
    const totalPhotos = allAlbums.reduce((sum, a) => sum + a.photoCount, 0);

    return {
      id,
      nameKh: item.nameKh,
      nameEn: item.nameEn,
      emoji: item.emoji,
      coverImage: item.coverImage,
      accent: item.accent,
      month: item.month,
      description: item.description,
      yearCount: item.years.length,
      eventCount: allEvents.length,
      albumCount: allAlbums.length,
      photoCount: totalPhotos,
      years: item.years,
    };
  });
}

export function getMockFestivalDetail(festivalId: string): (typeof MOCK_HIERARCHY_DATA)["chaul-chnam"] {
  const fest = MOCK_HIERARCHY_DATA[festivalId];
  return fest || MOCK_HIERARCHY_DATA["chaul-chnam"]!;
}

export function getMockFestivalEventsForYear(festivalId: string, year: number): HierarchyEvent[] {
  const fest = getMockFestivalDetail(festivalId);
  const events = fest.eventsByYear[year];
  if (events && events.length > 0) {
    return events;
  }
  return [
    {
      id: `${festivalId}-${year}-general`,
      festivalId,
      year,
      nameKh: `ពិធីបុណ្យ ${fest.nameKh} ប្រចាំឆ្នាំ ${year}`,
      nameEn: `Celebrations of ${fest.nameEn} (${year})`,
      description: `កម្រងរូបភាពបណ្ណសារប្រពៃណីនៃពិធីបុណ្យ ${fest.nameKh} វត្តពារាំង ប្រចាំឆ្នាំ ${year}។`,
      date: `ឆ្នាំ ${year}`,
      location: "វត្តពារាំង",
      icon: fest.emoji,
      coverImage: fest.coverImage,
      photoCount: 24,
      albums: [
        {
          id: `alb-${festivalId}-${year}-general`,
          festivalId,
          festivalNameKh: fest.nameKh,
          year,
          eventId: `${festivalId}-${year}-general`,
          eventNameKh: `ពិធីបុណ្យ ${fest.nameKh} ប្រចាំឆ្នាំ ${year}`,
          title: `កម្រងរូបភាពទូទៅនៃ ${fest.nameKh} (${year})`,
          description: `រូបភាពទូទៅនៃពិធីបុណ្យ ${fest.nameKh} វត្តពារាំង ឆ្នាំ ${year}។`,
          location: "វត្តពារាំង",
          date: `ឆ្នាំ ${year}`,
          coverImage: fest.coverImage,
          photoCount: 24,
          viewsCount: 280,
          likesCount: 45,
          photos: generateMockPhotos(`alb-${festivalId}-${year}-general`, 24, fest.nameKh, `កម្រងរូបភាព ${year}`),
        },
      ],
    },
  ];
}

export function getMockAlbumDetail(albumId: string): HierarchyAlbum | null {
  for (const fest of Object.values(MOCK_HIERARCHY_DATA)) {
    for (const events of Object.values(fest.eventsByYear)) {
      for (const ev of events) {
        const found = ev.albums.find((a) => a.id === albumId);
        if (found) return found;
      }
    }
  }

  const parts = albumId.split("-");
  const parsedYear = Number(parts[parts.length - 1]) || 2026;
  const festKey = parts[0] === "alb" ? parts[1] || "chaul-chnam" : parts[0] || "chaul-chnam";
  const fest = getMockFestivalDetail(festKey);

  return {
    id: albumId,
    festivalId: festKey,
    festivalNameKh: fest.nameKh,
    year: parsedYear,
    eventId: `${festKey}-${parsedYear}-general`,
    eventNameKh: `ពិធីបុណ្យ ${fest.nameKh} (${parsedYear})`,
    title: `កម្រងរូបភាព ${fest.nameKh} — ឆ្នាំ ${parsedYear}`,
    description: `បណ្ណសាររូបភាពប្រពៃណីវត្តពារាំង ពិធីបុណ្យ ${fest.nameKh} ប្រចាំឆ្នាំ ${parsedYear}។`,
    location: "វត្តពារាំង",
    date: `ឆ្នាំ ${parsedYear}`,
    coverImage: fest.coverImage,
    photoCount: 24,
    viewsCount: 320,
    likesCount: 65,
    photos: generateMockPhotos(albumId, 24, fest.nameKh, `កម្រងរូបភាព ${parsedYear}`),
  };
}
