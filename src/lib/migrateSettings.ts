import { Settings } from "@/types";
import { SETTINGS_VERSION } from "@/config/constants";

/**
 * Merges `loaded` settings with `defaults`, ensuring any keys that exist in
 * `defaults` but are absent from `loaded` are filled in. Also stamps
 * `settingsVersion` with the current version.
 *
 * Returns `{ migrated, changed }` where `changed` is true when the result
 * differs from `loaded` (caller should persist the migrated value).
 */
export function migrateSettings(
  loaded: Partial<Settings>,
  defaults: Settings
): { migrated: Settings; changed: boolean } {
  const migrated: Settings = { ...defaults, ...loaded, settingsVersion: SETTINGS_VERSION };

  const changed =
    loaded.settingsVersion !== SETTINGS_VERSION ||
    (Object.keys(defaults) as (keyof Settings)[]).some(
      (key) => !(key in loaded)
    );

  return { migrated, changed };
}
