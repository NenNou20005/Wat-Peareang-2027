import { useState, useRef, useEffect } from "react";
import { Image as ImageIcon, Upload, Save, X, RotateCcw, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { resolveImageUrl } from "@/lib/asset-resolver";
import defaultHeroImg from "@/assets/hero-angkor.jpg";

export function HeroImageManager() {
  const [currentHeroUrl, setCurrentHeroUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // New selected file state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch current hero setting
  const fetchCurrentHero = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/settings/hero");
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setCurrentHeroUrl(json.data?.heroImage || null);
        }
      }
    } catch (err) {
      console.warn("Failed to load current hero setting:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentHero();
  }, []);

  // Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      toast.error("សូមជ្រើសរើសឯកសាររូបភាពត្រឹមត្រូវ (JPG, PNG, WEBP)។");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Validate size (max 15MB)
    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error("ទំហំរូបភាពធំជាងកំណត់ (អតិបរមា 15MB)។");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Clean up previous preview URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Cancel selected file
  const handleCancel = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Save new hero image
  const handleSave = async () => {
    if (!selectedFile) {
      toast.error("សូមជ្រើសរើសរូបភាពជាមុនសិន។");
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/admin/settings/hero", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "ការ Upload រូបភាពបានបរាជ័យ។");
      }

      toast.success("បានផ្លាស់ប្តូររូបភាព Homepage Hero ដោយជោគជ័យ!");
      setCurrentHeroUrl(json.data?.heroImage || null);
      handleCancel(); // Clear pending file & preview
    } catch (err) {
      console.error("Hero upload error:", err);
      const msg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការ Upload រូបភាព។";
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  // Reset to default hero
  const handleResetToDefault = async () => {
    if (!confirm("តើអ្នកពិតជាចង់កំណត់រូបភាព Hero ទៅកាន់រូបដើម (Default) វិញមែនទេ?")) {
      return;
    }

    try {
      setIsResetting(true);
      const res = await fetch("/api/admin/settings/hero", {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "មិនអាចកំណត់ទៅ Default វិញបានទេ។");
      }

      toast.success("បានកំណត់រូបភាព Hero ទៅ Default វិញរួចរាល់!");
      setCurrentHeroUrl(null);
      handleCancel();
    } catch (err) {
      console.error("Hero reset error:", err);
      const msg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការកំណត់ទៅ Default។";
      toast.error(msg);
    } finally {
      setIsResetting(false);
    }
  };

  const currentDisplayUrl = currentHeroUrl ? resolveImageUrl(currentHeroUrl) : defaultHeroImg;

  return (
    <div className="rounded-3xl border-2 border-gold/40 bg-card p-6 shadow-card space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gold/15 text-gold shadow-xs">
            <span className="text-xl">🖼️</span>
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-foreground">
              Homepage Hero Image / រូបផ្ទាំងធំ
            </h3>
            <p className="text-xs text-muted-foreground">
              គ្រប់គ្រង និងផ្លាស់ប្តូររូបភាពផ្ទាំងធំ (Hero Banner) នៅលើទំព័រដើម Website
            </p>
          </div>
        </div>

        {currentHeroUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isResetting || isUploading}
            onClick={handleResetToDefault}
            className="rounded-full text-xs text-muted-foreground hover:text-foreground"
          >
            {isResetting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            )}
            កំណត់ទៅ Default វិញ
          </Button>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Box 1: Current Hero Preview */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <span>រូបភាពបច្ចុប្បន្ន (Current Hero)</span>
            </span>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] text-muted-foreground font-medium">
              {currentHeroUrl ? "Custom Hero (R2 / Storage)" : "Default (អង្គរវត្ត)"}
            </span>
          </div>

          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-border bg-secondary/40 shadow-xs group">
            {isLoading ? (
              <div className="grid h-full w-full place-items-center">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/60" />
              </div>
            ) : (
              <>
                <img
                  src={currentDisplayUrl}
                  alt="Current Homepage Hero"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-102"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-70" />
                <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white text-[11px]">
                  <span className="rounded-full bg-black/60 px-2.5 py-0.5 backdrop-blur-xs flex items-center gap-1">
                    <Check className="h-3 w-3 text-gold" /> កំពុងបង្ហាញលើ Homepage
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Box 2: Select from PC & Preview New Image */}
        <div className="space-y-2.5 flex flex-col">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <span>រូបភាពថ្មី (New Hero Preview)</span>
            </span>
            {selectedFile && (
              <span className="text-[10px] text-gold font-medium">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            )}
          </div>

          <div className="relative aspect-[16/9] w-full flex-1 overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center text-center p-4 transition-colors hover:border-gold/50">
            {previewUrl ? (
              <>
                <img
                  src={previewUrl}
                  alt="New Hero Preview"
                  className="h-full w-full object-cover rounded-xl"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-70" />
                <div className="absolute top-2.5 right-2.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleCancel}
                    className="h-7 w-7 rounded-full bg-black/70 text-white hover:bg-black/90 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="absolute bottom-2.5 left-2.5 rounded-full bg-gold text-primary-foreground px-2.5 py-0.5 text-[10px] font-bold shadow-sm">
                  ត្រៀម Save ជារូប Hero ថ្មី
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-muted-foreground/80">
                  <ImageIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    មិនទាន់បានជ្រើសរើសរូបភាពថ្មីឡើយ
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    អនុញ្ញាតឯកសារ JPG, JPEG, PNG, WEBP (អតិបរមា 15MB)
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full bg-card hover:bg-muted font-medium text-xs cursor-pointer shadow-2xs"
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5 text-gold" />
                  📁 ជ្រើសរូបពី PC
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border/60">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full text-xs font-medium cursor-pointer"
          >
            <Upload className="mr-1.5 h-3.5 w-3.5 text-gold" />
            📁 {selectedFile ? "ជ្រើសរូបផ្សេងទៀត" : "ជ្រើសរូបពី PC"}
          </Button>

          {selectedFile && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-xs">
              {selectedFile.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedFile && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={handleCancel}
              className="rounded-full text-xs"
            >
              <X className="mr-1 h-3.5 w-3.5" />
              ✕ Cancel
            </Button>
          )}

          <Button
            type="button"
            disabled={!selectedFile || isUploading}
            onClick={handleSave}
            className="rounded-full bg-gold text-primary-foreground hover:bg-gold/90 text-xs font-semibold px-6 shadow-sm cursor-pointer"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                កំពុង Upload & រក្សាទុក...
              </>
            ) : (
              <>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                💾 Save (រក្សាទុក)
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

