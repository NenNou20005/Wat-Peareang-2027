import { createFileRoute, Link } from "@tanstack/react-router";
import { User, Phone, Mail, Facebook, ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/developer")({
  head: () => ({
    meta: [
      { title: "អ្នកអភិវឌ្ឍន៍ — បណ្ណសារបុណ្យខ្មែរ វត្តពារាំង" },
      {
        name: "description",
        content:
          "ព័ត៌មានអំពីអ្នកអភិវឌ្ឍន៍វេបសាយបណ្ណសាររូបភាពវត្តពារាំង (Developer Information) — Shal Vannou (សល់ វណ្ណនូ)។",
      },
      { property: "og:title", content: "អ្នកអភិវឌ្ឍន៍ (Developer) — វត្តពារាំង" },
      {
        property: "og:description",
        content: "Developed by Shal Vannou — ព័ត៌មានទំនាក់ទំនង និងប្រវត្តិអ្នកបង្កើត។",
      },
    ],
  }),
  component: DeveloperPage,
});

function DeveloperPage() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-10 lg:px-8">
      {/* Breadcrumb / Back Link */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> ត្រឡប់ទៅទំព័រដើម
        </Link>
      </div>

      {/* Page Header */}
      <div className="border-b border-border/80 pb-6">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold/15 text-2xl text-gold">
            👨‍💻
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-wide text-foreground sm:text-3xl">
              អ្នកអភិវឌ្ឍន៍
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Developer Profile & Contact Information
            </p>
          </div>
        </div>
      </div>

      {/* Main Developer Content Card */}
      <div className="mt-8 grid gap-8 md:grid-cols-12">
        {/* Left Column: Developer Profile Card */}
        <div className="md:col-span-7">
          <div className="rounded-3xl border border-gold/30 bg-card p-6 shadow-card sm:p-8">
            {/* Developer Profile Photo Header Section */}
            <div className="flex flex-col items-center text-center">
              {/* Circular Profile Photo with Elegant Soft Warm Amber Glow */}
              <div className="relative group my-2">
                {/* Soft ambient golden back-glow */}
                <div
                  className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-gold/30 via-gold/50 to-amber-200/40 blur-md transition-all duration-500 group-hover:scale-105 group-hover:opacity-100 opacity-80"
                  aria-hidden="true"
                />

                {/* Profile Image Container */}
                <div className="developer-glow-pulse relative flex h-[105px] w-[105px] sm:h-[125px] sm:w-[125px] md:h-[135px] md:w-[135px] items-center justify-center rounded-full bg-secondary/40 p-1 transition-transform duration-300 ease-out group-hover:scale-[1.02]">
                  <img
                    src="/assets/developer-profile.svg"
                    alt="Ven Shal Vannou - Developer Profile"
                    className="h-full w-full rounded-full object-cover shadow-inner"
                    loading="eager"
                  />
                </div>
              </div>

              {/* Order: Developed by : Shal Vannou */}
              <div className="mt-4">
                <h2 className="text-xl font-bold text-gold sm:text-2xl">
                  Developed by : Shal Vannou
                </h2>
              </div>
            </div>

            <div className="my-6 khmer-divider" />

            <div className="space-y-6">
              {/* Order: អ្នកអភិវឌ្ឍន៍ (Developer) -> Shal Vannou (សល់ វណ្ណនូ) */}
              <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
                <div className="flex items-center gap-2 text-gold">
                  <User className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    អ្នកអភិវឌ្ឍន៍ (Developer)
                  </span>
                </div>
                <p className="mt-2 text-base font-semibold text-foreground sm:text-lg">
                  Shal Vannou (សល់ វណ្ណនូ)
                </p>
              </div>

              {/* Phone Number */}
              <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
                <span className="text-xs font-medium text-muted-foreground">លេខទូរស័ព្ទ</span>
                <div className="mt-1.5">
                  <a
                    href="tel:0962579012"
                    className="inline-flex items-center gap-2.5 font-medium text-gold transition-colors hover:text-gold/80 hover:underline"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-gold/15 text-gold">
                      <Phone className="h-4 w-4" />
                    </span>
                    <span className="text-base font-semibold">096 257 9012</span>
                  </a>
                </div>
              </div>

              {/* Email Address */}
              <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
                <span className="text-xs font-medium text-muted-foreground">អ៊ីមែល</span>
                <div className="mt-1.5">
                  <a
                    href="mailto:shalvannouyear2005@gmail.com"
                    className="inline-flex items-center gap-2.5 font-medium text-gold transition-colors hover:text-gold/80 hover:underline break-all"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-gold/15 text-gold">
                      <Mail className="h-4 w-4" />
                    </span>
                    <span className="text-base font-semibold">shalvannouyear2005@gmail.com</span>
                  </a>
                </div>
              </div>

              {/* Facebook Profile Link */}
              <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
                <span className="text-xs font-medium text-muted-foreground">Facebook</span>
                <div className="mt-1.5">
                  <a
                    href="https://www.facebook.com/Nen.nou0/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2.5 font-medium text-gold transition-colors hover:text-gold/80 hover:underline"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-gold/15 text-gold">
                      <Facebook className="h-4 w-4" />
                    </span>
                    <span className="text-base font-semibold">Ven Shal Vannou</span>
                    <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Project & Purpose Details */}
        <div className="space-y-6 md:col-span-5">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-lg text-primary-foreground">
                🏛️
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-foreground">
                  វត្ត ពារាំង (Wat Peareang)
                </h3>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Khmer Festival Photo Archive
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              គេហទំព័រនេះត្រូវបានបង្កើតឡើងដោយការយកចិត្តទុកដាក់ខ្ពស់
              ដើម្បីជាបណ្ណសារឌីជីថលសម្រាប់រក្សាទុក រៀបចំ និងចែករំលែកនូវរូបភាពអនុស្សាវរីយ៍
              និងពិធីបុណ្យប្រពៃណីខ្មែរ។
            </p>

            <div className="mt-6 space-y-3 border-t border-border/70 pt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 text-foreground">
                <ShieldCheck className="h-4 w-4 text-gold" />
                <span className="font-medium">ប្រព័ន្ធបណ្ណសាររូបភាព</span>
              </div>
              <p>© ២០២៦ រក្សាសិទ្ធិគ្រប់យ៉ាងដោយ សល់ វណ្ណនូ (Shal Vannou)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
