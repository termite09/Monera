import { Settings } from "@/types";
import { SETTINGS_VERSION } from "@/config/constants";
import { currencyCode } from "@/lib/format";

/**
 * Merges `loaded` settings with `defaults`, filling in keys that exist in
 * `defaults` but are missing from `loaded`, converting a stored currency symbol
 * ("€") to its ISO code ("EUR"), and stamping the current `settingsVersion`.
 *
 * Returns `{ migrated, changed }` where `changed` is true when the result
 * differs from `loaded` (caller should persist the migrated value).
 */
export function migrateSettings(
  loaded: Partial<Settings>,
  defaults: Settings
): { migrated: Settings; changed: boolean } {
  const merged: Settings = { ...defaults, ...loaded, settingsVersion: SETTINGS_VERSION };
  const migrated: Settings = { ...merged, currency: currencyCode(merged.currency) };
  // Version 3: money moved to an investment account is saving, not spending.
  // Added once to existing lists; if the user removes it later, it stays removed.
  if ((loaded.settingsVersion ?? 0) < 3 && loaded.savingsVaultKeywords && !loaded.savingsVaultKeywords.includes("investment account")) {
    migrated.savingsVaultKeywords = [...loaded.savingsVaultKeywords, "investment account"];
  }

  const changed =
    loaded.settingsVersion !== SETTINGS_VERSION ||
    migrated.currency !== loaded.currency ||
    (Object.keys(defaults) as (keyof Settings)[]).some((key) => !(key in loaded));

  return { migrated, changed };
}
