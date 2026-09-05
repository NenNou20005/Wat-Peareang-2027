import { useState, useRef, useEffect } from "react";
import { User, Upload, Save, X, RotateCcw, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { resolveImageUrl } from "@/lib/asset-resolver";

const DEFAULT_DEV_PROFILE_IMG = "/assets/developer-profile.svg";

export function DeveloperProfileManager() {
  const [currentProfileUrl, setCurrentProfileUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // New selected file state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch current developer profile setting
  const fetchCurrentProfile = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/settings/developer-profile");
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setCurrentProfileUrl(json.data?.profileImage || null);
        }
      }
    } catch (err) {
      console.warn("Failed to load developer profile setting:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentProfile();
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

  // Save new developer profile image
  const handleSave = async () => {
    if (!selectedFile) {
      toast.error("សូមជ្រើសរើសរូបភាពជាមុនសិន។");
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/admin/settings/developer-profile", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "ការ Upload រូបភាពបានបរាជ័យ។");
      }

      toast.success("បានផ្លាស់ប្តូររូបថត Developer Profile ដោយជោគជ័យ!");
      setCurrentProfileUrl(json.data?.profileImage || null);
      handleCancel(); // Clear pending file & preview
    } catch (err) {
      console.error("Developer profile upload error:", err);
      const msg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការ Upload រូបភាព Profile។";
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  // Reset to default developer profile image
  const handleResetToDefault = async () => {
    if (!confirm("តើអ្នកពិតជាចង់កំណត់រូបថត Profile ទៅកាន់រូបដើម (Default) វិញមែនទេ?")) {
      return;
    }

    try {
      setIsResetting(true);
      const res = await fetch("/api/admin/settings/developer-profile", {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "មិនអាចកំណត់ទៅ Default វិញបានទេ។");
      }

      toast.success("បានកំណត់រូបថត Profile ទៅ Default វិញរួចរាល់!");
      setCurrentProfileUrl(null);
      handleCancel();
    } catch (err) {
      console.error("Developer profile reset error:", err);
      const msg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការកំណត់ទៅ Default។";
      toast.error(msg);
    } finally {
      setIsResetting(false);
    }
  };

  const currentDisplayUrl = currentProfileUrl
    ? resolveImageUrl(currentProfileUrl)
    : DEFAULT_DEV_PROFILE_IMG;

  return (
    <div
      id="developer-profile-manager-card"
      className="rounded-3xl border-2 border-gold/40 bg-card p-6 shadow-card space-y-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gold/15 text-gold shadow-xs">
            <span className="text-xl">👨‍💻</span>
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-foreground">
              រូបថតអ្នកអភិវឌ្ឍន៍ / Developer Profile Photo
            </h3>
            <p className="text-xs text-muted-foreground">
              គ្រប់គ្រង និងផ្លាស់ប្តូររូបថត Profile អ្នកអភិវឌ្ឍន៍ (បង្ហាញនៅលើទំព័រ «អ្នកអភិវឌ្ឍន៍»)
            </p>
          </div>
        </div>

        {currentProfileUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isResetting || isUploading}
            onClick={handleResetToDefault}
            className="rounded-full text-xs text-muted-foreground hover:text-foreground cursor-pointer"
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
        {/* Box 1: Current Profile Circle Preview */}
        <div className="space-y-3 flex flex-col items-center text-center p-4 rounded-2xl border border-border/70 bg-secondary/20">
          <div className="w-full flex items-center justify-between text-xs pb-2 border-b border-border/40">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <span>រូបថតបច្ចុប្បន្ន (Current Profile)</span>
            </span>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] text-muted-foreground font-medium">
              {currentProfileUrl ? "Custom Profile (R2 / Storage)" : "Default Profile"}
            </span>
          </div>

          <div className="my-auto py-3 flex flex-col items-center">
            {isLoading ? (
              <div className="grid h-40 w-40 place-items-center rounded-full bg-secondary/40 border border-border">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/60" />
              </div>
            ) : (
              <div className="relative group">
                {/* Ambient glow */}
                <div
                  className="absolute -inset-2 rounded-full bg-gradient-to-tr from-gold/30 via-gold/50 to-amber-200/40 blur-md transition-all duration-500 opacity-70 group-hover:opacity-100"
                  aria-hidden="true"
                />
                {/* Circular image */}
                <div className="relative h-36 w-36 sm:h-40 sm:w-40 rounded-full border-4 border-gold/60 p-1 bg-card shadow-card overflow-hidden">
                  <img
                    src={currentDisplayUrl}
                    alt="Current Developer Profile"
                    className="h-full w-full rounded-full object-cover aspect-square transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-white text-[11px] backdrop-blur-xs">
              <Check className="h-3 w-3 text-gold" />
              <span>កំពុងបង្ហាញលើ Developer Page (1:1 Circle)</span>
            </div>
          </div>
        </div>

        {/* Box 2: Select from PC & Preview New Image (Circle 1:1) */}
        <div className="space-y-3 flex flex-col items-center text-center p-4 rounded-2xl border-2 border-dashed border-border bg-muted/20 hover:border-gold/50 transition-colors">
          <div className="w-full flex items-center justify-between text-xs pb-2 border-b border-border/40">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <span>រូបថតថ្មី (New Profile Preview)</span>
            </span>
            {selectedFile && (
              <span className="text-[10px] text-gold font-medium">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            )}
          </div>

          <div className="my-auto py-2 w-full flex flex-col items-center justify-center">
            {previewUrl ? (
              <div className="relative flex flex-col items-center">
                {/* Ambient glow for preview */}
                <div
                  className="absolute -inset-2 rounded-full bg-gradient-to-tr from-gold/40 via-gold/60 to-amber-200/50 blur-md opacity-80"
                  aria-hidden="true"
                />
                {/* Circular image */}
                <div className="relative h-36 w-36 sm:h-40 sm:w-40 rounded-full border-4 border-gold p-1 bg-card shadow-card overflow-hidden">
                  <img
                    src={previewUrl}
                    alt="New Profile Preview"
                    className="h-full w-full rounded-full object-cover aspect-square"
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleCancel}
                  className="absolute top-0 right-0 h-7 w-7 rounded-full bg-black/70 text-white hover:bg-black/90 cursor-pointer shadow-md"
                  title="បោះបង់រូបនេះ"
                >
                  <X className="h-4 w-4" />
                </Button>

                <div className="mt-3 rounded-full bg-gold text-primary-foreground px-3 py-1 text-[11px] font-bold shadow-sm">
                  ត្រៀម Save ជារូប Profile ថ្មី (1:1 Circle)
                </div>
              </div>
            ) : (
              <div className="space-y-3 py-4 flex flex-col items-center">
                <div className="grid h-24 w-24 place-items-center rounded-full border-2 border-dashed border-border bg-secondary/50 text-muted-foreground/80">
                  <User className="h-10 w-10 text-muted-foreground/60" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    មិនទាន់បានជ្រើសរើសរូបថតថ្មីឡើយ
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    អនុញ្ញាតឯកសារ JPG, PNG, WEBP (អតិបរមា 15MB)
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
              className="rounded-full text-xs cursor-pointer"
            >
              <X className="mr-1 h-3.5 w-3.5" />
              ✕ បោះបង់
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

