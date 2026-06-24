import { describe, it, expect } from "vitest";
import { migrateSettings } from "@/lib/migrateSettings";
import { DEFAULT_SETTINGS, SETTINGS_VERSION } from "@/config/constants";
import { Settings } from "@/types";

const defaults = DEFAULT_SETTINGS as Settings;

describe("migrateSettings", () => {
  it("fills in missing keys from defaults", () => {
    const loaded: Partial<Settings> = { currency: "£", paydayOfMonth: 25 };
    const { migrated } = migrateSettings(loaded, defaults);
    // Provided values are preserved
    expect(migrated.currency).toBe("£");
    expect(migrated.paydayOfMonth).toBe(25);
    // Missing keys come from defaults
    expect(migrated.salaryKeywords).toEqual(defaults.salaryKeywords);
    expect(migrated.defaultBudgetRule).toEqual(defaults.defaultBudgetRule);
    expect(migrated.recurringPayments).toEqual(defaults.recurringPayments);
  });

  it("stamps settingsVersion with the current version", () => {
    const loaded: Partial<Settings> = { currency: "€" };
    const { migrated } = migrateSettings(loaded, defaults);
    expect(migrated.settingsVersion).toBe(SETTINGS_VERSION);
  });

  it("marks changed=true when loaded is missing keys present in defaults", () => {
    const loaded: Partial<Settings> = { currency: "€", settingsVersion: SETTINGS_VERSION };
    const { changed } = migrateSettings(loaded, defaults);
    expect(changed).toBe(true);
  });

  it("marks changed=true when settingsVersion differs", () => {
    // Simulate a stored settings object that has all keys but an old version stamp.
    const loaded: Settings = { ...defaults, settingsVersion: 0 };
    const { changed } = migrateSettings(loaded, defaults);
    expect(changed).toBe(true);
  });

  it("marks changed=false when loaded already matches defaults and version is current", () => {
    const loaded: Settings = { ...defaults };
    const { changed } = migrateSettings(loaded, defaults);
    expect(changed).toBe(false);
  });

  it("loaded values win over defaults", () => {
    const loaded: Partial<Settings> = {
      currency: "USD",
      paydayOfMonth: 15,
      salaryKeywords: ["payroll"],
      settingsVersion: SETTINGS_VERSION,
    };
    const { migrated } = migrateSettings(loaded, defaults);
    expect(migrated.currency).toBe("USD");
    expect(migrated.paydayOfMonth).toBe(15);
    expect(migrated.salaryKeywords).toEqual(["payroll"]);
  });

  it("DEFAULT_SETTINGS includes settingsVersion set to SETTINGS_VERSION", () => {
    expect(defaults.settingsVersion).toBe(SETTINGS_VERSION);
    expect(SETTINGS_VERSION).toBe(1);
  });

  it("backfills excludedSubscriptions to [] when missing", () => {
    const { migrated, changed } = migrateSettings({} as Settings, defaults);
    expect(migrated.excludedSubscriptions).toEqual([]);
    expect(changed).toBe(true);
  });
});
