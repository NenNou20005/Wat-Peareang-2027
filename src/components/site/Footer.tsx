import { Link } from "@tanstack/react-router";
import { Compass, Layers } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-20 bg-temple-deep text-temple-foreground">
      <div
        className="h-16 w-full bg-repeat-x opacity-80"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='60' viewBox='0 0 120 60'%3E%3Cg fill='none' stroke='%23c9a24a' stroke-width='1.4'%3E%3Cpath d='M0 58h120'/%3E%3Cpath d='M20 58V40l8-14 8 14v18'/%3E%3Cpath d='M60 58V34l10-18 10 18v24'/%3E%3Cpath d='M100 58V42l6-10 6 10v16'/%3E%3C/g%3E%3C/svg%3E\")",
        }}
        aria-hidden
      />
      <div className="mx-auto max-w-[1400px] px-4 pb-10 lg:px-8">
        <div className="khmer-divider mb-10" />

        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-12">
          {/* About Us & Logo */}
          <div className="space-y-4 md:col-span-2 lg:col-span-6">
            <div className="flex items-center gap-3.5">
              <div className="relative flex shrink-0 items-center justify-center">
                <img
                  src="/favicon.png"
                  alt="វត្ត ពារាំង - Wat Peareang"
                  className="h-12 w-12 sm:h-14 sm:w-14 object-contain transition-transform duration-300 hover:scale-105"
                  style={{
                    filter:
                      "drop-shadow(0 0 8px rgba(201, 162, 74, 0.65)) drop-shadow(0 0 16px rgba(201, 162, 74, 0.35))",
                    animation: "softGlowPulse 4s ease-in-out infinite",
                  }}
                />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold tracking-wide text-gold sm:text-xl">
                  វត្ត ពារាំង
                </h2>
                <p className="text-xs font-medium tracking-wider text-temple-foreground/75 uppercase">
                  Wat Peareang
                </p>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-temple-foreground/80">
              វត្ត ពារាំង គឺជាវេបសាយដែលបង្កើតឡើង ក្នុងគោលបំណងរក្សាទុក រៀបចំ និងចែករំលែករូបភាព
              ព័ត៌មាន និងឯកសារដែលពាក់ព័ន្ធនិងបុណ្យខ្មែរ។
            </p>

            <div className="flex items-center gap-2 pt-1 text-gold/90">
              <span className="text-base" aria-hidden>
                🪷
              </span>
              <span className="text-xs font-medium text-temple-foreground/70">
                បណ្ណសាររូបភាព រក្សាទុកអនុស្សាវរីយ៍
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="grid grid-cols-2 gap-6 sm:gap-8 md:col-span-2 lg:col-span-6">
            <div>
              <div className="flex items-center gap-2 text-gold">
                <Compass className="h-4 w-4" />
                <h3 className="text-sm font-semibold">រុករកបណ្ណសារ</h3>
              </div>
              <ul className="mt-4 space-y-2.5 text-sm text-temple-foreground/75">
                <li>
                  <Link to="/years" className="transition-colors hover:text-gold">
                    តាមឆ្នាំ
                  </Link>
                </li>
                <li>
                  <Link to="/festivals" className="transition-colors hover:text-gold">
                    តាមពិធីបុណ្យ
                  </Link>
                </li>
                <li>
                  <Link to="/albums" className="transition-colors hover:text-gold">
                    Albums រូបភាព
                  </Link>
                </li>
                <li>
                  <Link to="/search" className="transition-colors hover:text-gold">
                    ស្វែងរក
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <div className="flex items-center gap-2 text-gold">
                <Layers className="h-4 w-4" />
                <h3 className="text-sm font-semibold">ទំព័រ</h3>
              </div>
              <ul className="mt-4 space-y-2.5 text-sm text-temple-foreground/75">
                <li>
                  <Link to="/" className="transition-colors hover:text-gold">
                    ទំព័រដើម
                  </Link>
                </li>
                <li>
                  <Link to="/favorites" className="transition-colors hover:text-gold">
                    រូបភាពចំណូលចិត្ត
                  </Link>
                </li>
                <li>
                  <Link to="/developer" className="transition-colors hover:text-gold">
                    អ្នកអភិវឌ្ឍន៍
                  </Link>
                </li>
                <li>
                  <Link to="/admin/login" className="transition-colors hover:text-gold">
                    ចូលគ្រប់គ្រង
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="khmer-divider mt-10" />

        {/* Copyright */}
        <div className="mt-6 flex flex-col items-center justify-between gap-2 text-center text-xs text-temple-foreground/60 sm:flex-row sm:text-left">
          <p>
            © ២០២៦ Developed by{" "}
            <Link to="/developer" className="text-gold hover:underline">
              Shal Vannou
            </Link>{" "}
            (សល់ វណ្ណនូ)
          </p>
          <p>រក្សាសិទ្ធិគ្រប់យ៉ាង</p>
        </div>
      </div>
    </footer>
  );
}
