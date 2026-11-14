import { describe, expect, it } from "vitest";
import { autoTags, classifySection } from "@/lib/content/classify";

describe("automatic sections", () => {
  it("files real Instagram captions into the right section", () => {
    expect(classifySection("Argentina suffered a 2-1 defeat against Uruguay on Friday in their first match since Lionel Messi retired from international football.")).toBe("sports");
    expect(classifySection("23 years is a long wait. Could this finally be Bangladesh's moment to bring the SAFF Championship trophy home?")).toBe("sports");
    expect(classifySection("The GTA 6 pop-up store can be found in the Selfridges on Oxford Street")).toBe("entertainment");
    expect(classifySection("Six British politicians have urged the UK government to seek guarantees from Bangladesh that former prime minister Sheikh Hasina will not face execution")).toBe("politics");
    expect(classifySection("More than 100 teenage gang members staged an armed display in Dhaka's Kadamtali area on Friday afternoon")).toBe("dhaka");
    expect(classifySection("Nvidia CEO Jensen Huang has resigned; Nvidia shares fell more than 13 percent")).toBe("business");
    expect(classifySection("The US Federal Aviation Administration (FAA) halted all departing flights nationwide")).toBe("international");
  });

  it("always returns a section, falling back to national", () => {
    expect(classifySection("")).toBe("national");
    expect(classifySection("A quiet day.")).toBe("national");
  });

  it("understands Bangla captions", () => {
    expect(classifySection("ঘরের মাঠে ক্রিকেট ম্যাচে টাইগারদের জয়")).toBe("sports");
    expect(classifySection("উত্তরায় পুলিশের অভিযান")).toBe("dhaka");
  });
});

describe("automatic tags", () => {
  it("finds known people, places and topics, plus hashtags", () => {
    const tags = autoTags("Six British politicians urged guarantees for Sheikh Hasina in Bangladesh #HumanRights #dhakachronicles");
    const names = tags.map((t) => t.en);
    expect(names).toContain("Sheikh Hasina");
    expect(names).toContain("Bangladesh");
    expect(names).toContain("Human Rights");
    expect(names).not.toContain("Dhakachronicles");
  });

  it("caps at six tags with ASCII slugs and no duplicates", () => {
    const tags = autoTags("Bangladesh Dhaka Hasina BNP election cricket football Messi Argentina #Bangladesh");
    expect(tags.length).toBeLessThanOrEqual(6);
    expect(new Set(tags.map((t) => t.slug)).size).toBe(tags.length);
    for (const t of tags) expect(t.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe("sponsored detection", () => {
  it("tags brand collaborations as Sponsored", async () => {
    const { autoTags, isSponsored } = await import("@/lib/content/classify");
    expect(isSponsored("Our new menu, in collaboration with Pizza Hut Bangladesh")).toBe(true);
    expect(isSponsored("Big launch tonight #ad")).toBe(true);
    expect(isSponsored("Grand opening #adventure")).toBe(false);
    expect(isSponsored("Parliament opens budget session")).toBe(false);
    expect(autoTags("Paid partnership with Brand X #collab")[0]?.slug).toBe("sponsored");
  });
});
