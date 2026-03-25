import prompts from "./prompts.json";
import { parseReadmeSections, mapReadmeToLandingPageSections, extractDependencies, inferProjectType } from "./generate";

interface CreativeDirectorInput {
  pins: { url: string; title: string; description: string; thumbnail?: string | null }[];
  repoContent: {
    name: string;
    description: string;
    readme: string;
    language: string;
    topics: string[];
    stars: number;
    packageJson: string;
    fileTree: string[];
  } | null;
  userPrompt: string;
  presets: { category: string; name: string; value: string }[];
}

const BRIEF_SCHEMA = `{
  "colors": [
    { "name": "Primary", "hex": "#hexcode", "usage": "CTAs, accents, key interactive elements" },
    { "name": "Secondary", "hex": "#hexcode", "usage": "Supporting elements, secondary buttons" },
    { "name": "Accent", "hex": "#hexcode", "usage": "Highlights, badges, special callouts" },
    { "name": "Background", "hex": "#hexcode", "usage": "Page background" },
    { "name": "Surface", "hex": "#hexcode", "usage": "Card backgrounds, elevated surfaces" },
    { "name": "Text", "hex": "#hexcode", "usage": "Primary text color" }
  ],
  "typography": {
    "headings": "Font name for headings (Google Fonts)",
    "body": "Font name for body text (Google Fonts)",
    "scale": "Description of the type scale — e.g. 'Large hero (72px), section headings (40px), body (18px)'"
  },
  "sections": [
    {
      "id": "hero",
      "type": "Hero",
      "headline": "The main hero headline (8-12 words)",
      "body": "1-2 sentence subheadline expanding on the value proposition",
      "cta": "CTA button text (first-person, action-oriented)",
      "notes": "Design notes for this section"
    }
  ],
  "designNotes": "Overall design direction — layout feel, spacing, animation preferences, visual style",
  "product": {
    "name": "Product name",
    "tagline": "One-line product tagline",
    "features": ["Feature 1", "Feature 2", "Feature 3"],
    "techStack": "Key technologies the product uses"
  }
}`;

export function buildCreativeDirectorPrompt(input: CreativeDirectorInput): string {
  const sections: string[] = [];

  // Role
  sections.push(
    "# Role & Task\n" +
    "You are an expert creative director and conversion-focused copywriter.\n" +
    "Your job is to analyze the provided inspiration, product information, and design preferences, " +
    "then produce a comprehensive creative brief for a landing page.\n\n" +
    "You are NOT writing code. You are producing a structured JSON brief that a developer will implement."
  );

  // Design preferences (presets)
  if (input.presets.length > 0) {
    const grouped: Record<string, string> = {};
    for (const p of input.presets) {
      if (p.category !== "framework") { // framework is irrelevant for creative direction
        grouped[p.category] = `${p.name}: ${p.value}`;
      }
    }
    if (Object.keys(grouped).length > 0) {
      sections.push(
        "# Design Preferences\n" +
        Object.entries(grouped).map(([k, v]) => `- **${k}:** ${v}`).join("\n")
      );
    }
  }

  // Copy guidelines
  sections.push(prompts.copyGuidelines);

  // Section blueprint (for reference on what sections to produce)
  sections.push(
    "# Section Blueprint\n" +
    "Produce copy and design direction for these sections (adjust order based on the layout preset):\n" +
    "1. **Hero** — Headline (8-12 words), subheadline (1-2 sentences), CTA button text\n" +
    "2. **Problem/Pain** — Name the frustration, 2-3 short points\n" +
    "3. **Solution Overview** — Introduce the product as the answer\n" +
    "4. **How It Works** — 3-4 step process with titles and descriptions\n" +
    "5. **Features/Benefits** — 3-6 items, each with a bold title + 1-2 sentence benefit\n" +
    "6. **Social Proof** — Credibility indicators, stats, testimonial placeholders\n" +
    "7. **Final CTA** — Urgency/aspiration headline + CTA button\n" +
    "8. **Footer** — Keep minimal\n\n" +
    "You may reorder, combine, or split sections based on the layout preset. Each section needs an `id`, `type`, `headline`, `body`, and optionally `cta` and `notes`."
  );

  // Inspiration sites
  if (input.pins.length > 0) {
    const hasScreenshots = input.pins.some((p) => p.thumbnail);
    sections.push(
      "# Inspiration Sites\n" +
      (hasScreenshots
        ? "Screenshots of these websites are attached. Study their visual design — color palettes, typography, spacing, layout patterns, and overall aesthetic. Extract a cohesive color palette and design direction that matches these references.\n"
        : "Analyze these websites for visual design direction:\n") +
      input.pins.map((p, i) => {
        let line = `- ${p.url}${p.title ? ` — ${p.title}` : ""}${p.description ? `: ${p.description}` : ""}`;
        if (p.thumbnail && hasScreenshots) line += ` [Screenshot #${i + 1} attached]`;
        return line;
      }).join("\n")
    );
  }

  // Product information from repo
  if (input.repoContent) {
    const rc = input.repoContent;

    sections.push(
      "# Product Information\n" +
      `**Product:** ${rc.name}\n` +
      `**Description:** ${rc.description}\n` +
      `**Language:** ${rc.language}\n` +
      `**Topics:** ${rc.topics.join(", ")}\n` +
      (rc.stars > 0 ? `**GitHub Stars:** ${rc.stars.toLocaleString()}\n` : "")
    );

    const deps = extractDependencies(rc.packageJson);
    const allDeps = [...deps.prod, ...deps.dev];
    if (allDeps.length > 0) {
      const projectType = inferProjectType(allDeps, rc.fileTree);
      sections.push(`# Tech Stack\n**Project Type:** ${projectType}\n**Key Dependencies:** ${deps.prod.slice(0, 15).join(", ")}`);
    }

    if (rc.readme) {
      const readmeSections = parseReadmeSections(rc.readme);
      const mapped = mapReadmeToLandingPageSections(readmeSections);
      if (Object.keys(mapped).length > 0) {
        let intel = "# README Intelligence\nUse this content as source material for the copy. Rewrite for conversion — don't copy verbatim.\n";
        for (const [sectionName, content] of Object.entries(mapped)) {
          intel += `\n## ${sectionName}\n${content}\n`;
        }
        sections.push(intel);
      }
      sections.push(`# Full README Reference\n${rc.readme.slice(0, 6000)}`);
    }
  }

  // User guidance
  if (input.userPrompt) {
    sections.push(`# Additional Guidance\n${input.userPrompt}`);
  }

  // Output format
  sections.push(
    "# Output Format\n" +
    "Return ONLY a valid JSON object matching this exact schema (no markdown, no explanation, no code fences):\n\n" +
    BRIEF_SCHEMA + "\n\n" +
    "Requirements:\n" +
    "- Colors: extract from inspiration sites if possible, ensure WCAG AA contrast for text on background\n" +
    "- Typography: use Google Fonts that match the style preset\n" +
    "- Copy: benefit-driven, specific numbers when available, match the tone preset\n" +
    "- CTAs: first-person (\"Start My Project\" not \"Start Your Project\")\n" +
    "- Sections: include all relevant sections, ordered per the layout preset\n" +
    "- Each section must have a unique `id` (lowercase, e.g. 'hero', 'problem', 'features')"
  );

  return sections.join("\n\n");
}
