import type { MediaSettings } from "../settings-types";

export interface SettingsTabProps {
  settings: Required<MediaSettings>;
  update: (patch: Partial<MediaSettings>, message?: string) => void;
}

export type ProviderStatus = Record<"unsplash" | "pixabay" | "pexels", boolean>;

export interface AvatarPickerOption {
  id: string;
  category: string;
  thumbnail: string | null;
  videoCount: number;
}
