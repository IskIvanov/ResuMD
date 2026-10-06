/**
 * parser.ts
 *
 * Pure functions that parse a Resume.md string into structured data.
 * No file I/O — all functions accept a raw markdown string and return data.
 *
 * Run via: bun run resume:sync
 */

import { validateParsedResume } from "./schema.ts";
import type {
  ParsedCertification,
  ParsedContact,
  ParsedEduItem,
  ParsedJob,
  ParsedLanguage,
  ParsedLink,
  ParsedProject,
  ParsedResume,
  ParsedSkillGroup,
} from "./types.ts";

// Re-exported so modules that import the parsed types from the parser keep
// working; they are declared in types.ts.
export type {
  ParsedCertification,
  ParsedContact,
  ParsedEduItem,
  ParsedJob,
  ParsedLanguage,
  ParsedLink,
  ParsedProject,
  ParsedResume,
  ParsedSkillGroup,
} from "./types.ts";

// ─── Constants ────────────────────────────────────────────────────────────────

/** `## Heading` names the parser reads. */
const SectionHeading = {
  Summary: "Summary",
  Experience: "Experience",
  Skills: "Technical Skills",
  Education: "Education",
  Projects: "Projects",
  Certifications: "Certifications",
  Languages: "Languages",
  Interests: "Interests",
  References: "References",
} as const;
type SectionHeading = (typeof SectionHeading)[keyof typeof SectionHeading];

/** Line prefixes that always open a new logical line (bullet, heading, rule). */
const BLOCK_START_PREFIXES = ["- ", "#", "---"] as const;

const RULE = "---";
const BULLET_PREFIX = "- ";
const TECH_STACK_PREFIX = "**Tech Stack:**";
const CREDENTIAL_ID_LABEL = "Credential ID:";
/** Separates a name from its qualifier: `Company — Location`. */
const NAME_SEPARATOR = " — ";
const CONTACT_SEPARATOR = "|";
const INTEREST_SEPARATOR = "·";

/** Matches a `**Title** | dates` line; group 1 is the title, 2 the dates. */
const TITLE_LINE_REGEX = /^\*\*(.+?)\*\* \| (.+)$/;
/** Matches a line that is only bold text; group 1 is the text. */
const BOLD_LINE_REGEX = /^\*\*(.+)\*\*$/;
/** Matches a line opening with bold text; group 1 is it, 2 the remainder. */
const BOLD_PREFIX_REGEX = /^\*\*(.+?)\*\*\s*(.*)$/;
const URL_LINE_REGEX = /^https?:\/\/\S+$/;
/** Matches `[label](http(s)://url)`; group 1 is the label, 2 the URL. */
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[\d\s().-]{6,}$/;
const WEBSITE_REGEX = /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i;
/** Matches a standalone note such as "References available upon request". */
const REFERENCES_NOTE_REGEX = /^References\b/i;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Splits a Resume.md string into a map of `## Heading` → body.
 * Prepends a newline so the first heading is always found by /\n## /.
 */
function splitSections(md: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const parts = ("\n" + md).split(/\n## /);
  for (const part of parts.slice(1)) {
    const newlineIdx = part.indexOf("\n");
    const heading = part.slice(0, newlineIdx).trim();
    const body = part.slice(newlineIdx + 1);
    sections[heading] = body;
  }
  return sections;
}

/**
 * Joins hard-wrapped markdown lines (e.g. Prettier's 80-char wrap) into
 * logical lines. Blank lines and lines starting with a block marker open a new
 * logical line; every other line — indented bullet continuations and plain
 * paragraph continuations alike — is appended to the previous one.
 */
function unwrapLines(text: string): string[] {
  const logical: string[] = [];
  let current: string | null = null;

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const startsBlock = BLOCK_START_PREFIXES.some((p) => raw.startsWith(p));

    if (line.length === 0 || startsBlock || current === null) {
      if (current !== null) logical.push(current);
      current = line.length > 0 ? line : null;
    } else {
      current = `${current} ${line}`;
    }
  }
  if (current !== null) logical.push(current);

  return logical;
}

/** Logical lines of a `## Heading` section, without horizontal rules. */
function sectionLines(md: string, heading: SectionHeading): string[] {
  const body = splitSections(md)[heading];
  return body ? unwrapLines(body).filter((l) => l !== RULE) : [];
}

/** Logical lines of each `### ` block in a section, without rules. */
function sectionBlocks(md: string, heading: SectionHeading): string[][] {
  const body = splitSections(md)[heading];
  if (!body) return [];
  return body
    .split(/\n### /)
    .filter((block) => block.trim().length > 0)
    .map((block) => unwrapLines(block).filter((l) => l !== RULE));
}

/**
 * Extracts the name from a `### Name — Location` heading line.
 * Returns text before ' — ', or the full line if no ' — ' is present.
 */
function extractName(headingLine: string): string {
  const dashIdx = headingLine.indexOf(NAME_SEPARATOR);
  return dashIdx >= 0
    ? headingLine.slice(0, dashIdx).trim()
    : headingLine.trim();
}

/**
 * Extracts the location from a `### Name — Location` heading line.
 * Returns text after ' — ', or an empty string if no ' — ' is present.
 */
function extractLocation(headingLine: string): string {
  const dashIdx = headingLine.indexOf(NAME_SEPARATOR);
  return dashIdx >= 0
    ? headingLine.slice(dashIdx + NAME_SEPARATOR.length).trim()
    : "";
}

/** Bullet lines of a block, with the leading "- " stripped. */
function extractBullets(lines: string[]): string[] {
  return lines
    .filter((l) => l.startsWith(BULLET_PREFIX))
    .map((l) => l.slice(BULLET_PREFIX.length).trim());
}

/** The `**Tech Stack:**` value of a block, or an empty string. */
function extractStack(lines: string[]): string {
  const stackLine = lines.find((l) => l.startsWith(TECH_STACK_PREFIX));
  return stackLine ? stackLine.slice(TECH_STACK_PREFIX.length).trim() : "";
}

/** True for a line made up only of markdown links and `|` separators. */
function isLinkLine(line: string): boolean {
  const rest = line.replace(MARKDOWN_LINK_REGEX, "");
  return rest !== line && rest.split(CONTACT_SEPARATOR).join("").trim() === "";
}

/**
 * True for a plain paragraph: not a bullet, bold line, heading, bare URL or
 * line of links.
 */
function isParagraph(line: string): boolean {
  return (
    !line.startsWith(BULLET_PREFIX) &&
    !line.startsWith("**") &&
    !line.startsWith("#") &&
    !URL_LINE_REGEX.test(line) &&
    !isLinkLine(line)
  );
}

/**
 * The context paragraph of a block: the first plain paragraph after line
 * `afterIdx` and before the first bullet. Empty when there is none.
 */
function extractContext(lines: string[], afterIdx: number): string {
  for (const line of lines.slice(afterIdx + 1)) {
    if (line.startsWith(BULLET_PREFIX)) break;
    if (isParagraph(line)) return line;
  }
  return "";
}

// ─── Section parsers ──────────────────────────────────────────────────────────

/**
 * Extracts every markdown link with an http(s) URL from a piece of text.
 *
 * @param text - One or more lines of markdown.
 * @returns The links in document order; plain labels without a URL are
 *   ignored.
 *
 * @example
 * parseLinks("[GitHub](https://github.com/me) | F6S");
 * // [{ label: "GitHub", url: "https://github.com/me" }]
 */
export function parseLinks(text: string): ParsedLink[] {
  return [...text.matchAll(MARKDOWN_LINK_REGEX)].map((match) => ({
    label: match[1].trim(),
    url: match[2],
  }));
}

/**
 * Extracts personal details from the header above the first `## ` section:
 * `# Name`, a `**Headline**` line and an `a | b | c` contact line whose parts
 * are recognised by shape (email, phone, website), not position. The first
 * unrecognised part is the location. Markdown links anywhere below the
 * headline become profiles.
 *
 * @param md - The full Resume.md string.
 * @returns The details; fields that are not found are empty strings.
 */
export function parseContact(md: string): ParsedContact {
  const header = ("\n" + md).split(/\n## /)[0];
  const lines = header
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l !== RULE);

  const nameLine = lines.find((l) => l.startsWith("# "));
  const headlineIdx = lines.findIndex((l) => BOLD_LINE_REGEX.test(l));
  const headlineMatch =
    headlineIdx >= 0 ? BOLD_LINE_REGEX.exec(lines[headlineIdx]) : null;
  // Contact details come from the first line only; links are read from every
  // line, so profiles may share the contact line or follow on their own.
  const contactLines = lines
    .slice(headlineIdx + 1)
    .filter((l) => !l.startsWith("#"));
  const parts = (contactLines[0] ?? "")
    .split(CONTACT_SEPARATOR)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && parseLinks(p).length === 0);

  const email = parts.find((p) => EMAIL_REGEX.test(p)) ?? "";
  const phone = parts.find((p) => PHONE_REGEX.test(p)) ?? "";
  const website = parts.find((p) => p !== email && WEBSITE_REGEX.test(p)) ?? "";
  const location =
    parts.find((p) => p !== email && p !== phone && p !== website) ?? "";

  return {
    name: nameLine ? nameLine.slice(2).trim() : "",
    headline: headlineMatch ? headlineMatch[1].trim() : "",
    email,
    phone,
    location,
    website,
    profiles: parseLinks(contactLines.join("\n")),
  };
}

/**
 * Extracts the summary paragraph from a Resume.md string.
 * Returns an empty string if the `## Summary` section is missing.
 */
export function parseSummary(md: string): string {
  const body = splitSections(md)[SectionHeading.Summary];
  return body ? body.split(/\n---/)[0].trim() : "";
}

/**
 * Extracts all experience items from a Resume.md string.
 * Each `### Company — Location` block becomes one ParsedJob.
 */
export function parseExperience(md: string): ParsedJob[] {
  return sectionBlocks(md, SectionHeading.Experience).map((lines) => {
    const titleIdx = lines.findIndex((l) => TITLE_LINE_REGEX.test(l));
    const titleMatch =
      titleIdx >= 0 ? TITLE_LINE_REGEX.exec(lines[titleIdx]) : null;

    return {
      company: extractName(lines[0]),
      location: extractLocation(lines[0]),
      role: titleMatch ? titleMatch[1].trim() : "",
      period: titleMatch ? titleMatch[2].trim() : "",
      context: titleIdx >= 0 ? extractContext(lines, titleIdx) : "",
      bullets: extractBullets(lines),
      stack: extractStack(lines),
      website: lines.find((l) => URL_LINE_REGEX.test(l)) ?? "",
    };
  });
}

/**
 * Extracts all skill groups from a Resume.md string.
 * Each `**Heading:** item1, item2` line becomes one ParsedSkillGroup.
 */
export function parseSkills(md: string): ParsedSkillGroup[] {
  const groups: ParsedSkillGroup[] = [];
  const regex = /^\*\*(.+?):\*\* (.+)$/;

  for (const line of sectionLines(md, SectionHeading.Skills)) {
    const match = regex.exec(line);
    if (!match) continue;
    groups.push({
      heading: match[1].trim(),
      items: match[2]
        .split(", ")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  return groups;
}

/**
 * Extracts all education items from a Resume.md string.
 * Each `### School — Location` block becomes one ParsedEduItem.
 */
export function parseEducation(md: string): ParsedEduItem[] {
  return sectionBlocks(md, SectionHeading.Education).map((lines) => {
    const titleIdx = lines.findIndex((l) => TITLE_LINE_REGEX.test(l));
    const titleMatch =
      titleIdx >= 0 ? TITLE_LINE_REGEX.exec(lines[titleIdx]) : null;

    return {
      school: extractName(lines[0]),
      location: extractLocation(lines[0]),
      degree: titleMatch ? titleMatch[1].trim() : "",
      period: titleMatch ? titleMatch[2].trim() : "",
      // Context: the plain line that follows the degree line, before bullets.
      context: titleIdx >= 0 ? extractContext(lines, titleIdx) : "",
      bullets: extractBullets(lines),
    };
  });
}

/**
 * Extracts all projects from a Resume.md string.
 * Each `### Title` block becomes one ParsedProject; the heading is kept whole,
 * since a project title may itself contain " — ".
 */
export function parseProjects(md: string): ParsedProject[] {
  return sectionBlocks(md, SectionHeading.Projects).map((lines) => ({
    title: lines[0].trim(),
    context: extractContext(lines, 0),
    stack: extractStack(lines),
    links: parseLinks(lines.slice(1).join("\n")),
  }));
}

/**
 * Extracts all certifications from a Resume.md string.
 * Each `**Title** Issuer Credential ID: a, b` line becomes one
 * ParsedCertification; the credential ids are optional.
 */
export function parseCertifications(md: string): ParsedCertification[] {
  const certifications: ParsedCertification[] = [];

  for (const line of sectionLines(md, SectionHeading.Certifications)) {
    const match = BOLD_PREFIX_REGEX.exec(line);
    if (!match) continue;
    const [issuer, ids = ""] = match[2].split(CREDENTIAL_ID_LABEL);
    certifications.push({
      title: match[1].trim(),
      issuer: issuer.trim(),
      credentialIds: ids
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  return certifications;
}

/**
 * Extracts all languages from a Resume.md string.
 * Each `- Language — Fluency` bullet becomes one ParsedLanguage.
 */
export function parseLanguages(md: string): ParsedLanguage[] {
  return extractBullets(sectionLines(md, SectionHeading.Languages)).map(
    (bullet) => ({
      language: extractName(bullet),
      fluency: extractLocation(bullet),
    }),
  );
}

/**
 * Extracts the interests from a Resume.md string.
 * Reads the `A · B · C` line of the section, up to the first rule.
 */
export function parseInterests(md: string): string[] {
  const body = splitSections(md)[SectionHeading.Interests];
  if (!body) return [];
  return body
    .split(/\n---/)[0]
    .split(INTEREST_SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Extracts the references from a Resume.md string.
 * Reads each line of a `## References` section; without one, picks up a
 * standalone note such as "References available upon request".
 */
export function parseReferences(md: string): string[] {
  const lines = sectionLines(md, SectionHeading.References);
  if (lines.length > 0) {
    return lines.map((l) =>
      l.startsWith(BULLET_PREFIX) ? l.slice(BULLET_PREFIX.length).trim() : l,
    );
  }
  return unwrapLines(md).filter((l) => REFERENCES_NOTE_REGEX.test(l));
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Parses a full Resume.md string into a structured ParsedResume object and
 * validates it against ParsedResumeSchema.
 *
 * @param resume_data - The full Resume.md string.
 * @returns The parsed and validated resume.
 * @throws If required content is missing (the summary, a job's role or tech
 *   stack, a whole required section, …); the error names each path, e.g.
 *   `jobs[2].role: required`.
 */
export function parseResume(resume_data: string): ParsedResume {
  const ParsedResumeSchema: ParsedResume = {
    contact: parseContact(resume_data),
    summary: parseSummary(resume_data),
    jobs: parseExperience(resume_data),
    skillGroups: parseSkills(resume_data),
    eduItems: parseEducation(resume_data),
    projects: parseProjects(resume_data),
    certifications: parseCertifications(resume_data),
    languages: parseLanguages(resume_data),
    interests: parseInterests(resume_data),
    references: parseReferences(resume_data),
  };
  return validateParsedResume(ParsedResumeSchema);
}
