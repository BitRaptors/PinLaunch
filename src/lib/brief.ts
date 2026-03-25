import fs from "fs";
import path from "path";

export interface BriefSection {
  id: string;
  type: string;
  headline: string;
  body: string;
  cta?: string;
  notes?: string;
}

export interface Brief {
  colors: { name: string; hex: string; usage: string }[];
  typography: { headings: string; body: string; scale: string };
  sections: BriefSection[];
  designNotes: string;
  product: { name: string; tagline: string; features: string[]; techStack: string };
}

export function saveBrief(siteDir: string, brief: Brief): void {
  const outputDir = path.join(process.cwd(), "output", siteDir);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "brief.json"), JSON.stringify(brief, null, 2), "utf-8");
}

export function loadBrief(siteDir: string): Brief | null {
  const filePath = path.join(process.cwd(), "output", siteDir, "brief.json");
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}
