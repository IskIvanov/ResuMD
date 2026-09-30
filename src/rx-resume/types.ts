/**
 * types.ts
 *
 * Reactive Resume v5 API shapes: the resume `data` object and the bodies of
 * `POST /resumes` and `PUT /resumes/{id}`. Only the parts that Resume.md feeds
 * are declared in full; see https://rxresu.me/api/openapi/spec.json for the
 * complete schema.
 */

// ─── API shapes ───────────────────────────────────────────────────────────────

export interface Website {
  url: string;
  label: string;
  inlineLink: boolean;
}

export interface BasicsCustomField {
  id: string;
  icon: string;
  text: string;
  link: string;
}

export interface Basics {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  /** `url` needs a protocol; an empty `label` displays the URL as-is. */
  website: Pick<Website, "url" | "label">;
  customFields: BasicsCustomField[];
}

/** Layout fields shared by the summary and every section. */
interface SectionLayout {
  title: string;
  /** Phosphor icon name; empty string uses the template default. */
  icon: string;
  /** 1–6. */
  columns: number;
  hidden: boolean;
  showHeading?: boolean;
  keepTogether: boolean;
  startOnNewPage: boolean;
}

export interface Summary extends SectionLayout {
  /** HTML. */
  content: string;
}

export interface Section<TItem> extends SectionLayout {
  items: TItem[];
}

interface SectionItem {
  id: string;
  hidden: boolean;
}

export interface ExperienceRole {
  id: string;
  position: string;
  period: string;
  /** HTML. */
  description: string;
}

export interface ExperienceItem extends SectionItem {
  company: string;
  position: string;
  location: string;
  period: string;
  website: Website;
  /** HTML. */
  description: string;
  roles: ExperienceRole[];
}

export interface SkillItem extends SectionItem {
  icon: string;
  iconColor: string;
  name: string;
  proficiency: string;
  /** 0–5; 0 hides the level indicator. */
  level: number;
  keywords: string[];
}

export const SkillKeywordLayout = { Inline: "inline", List: "list" } as const;
export const SkillLayout = { Default: "default", Inline: "inline" } as const;

export interface SkillsSection extends Section<SkillItem> {
  keywordLayout?: (typeof SkillKeywordLayout)[keyof typeof SkillKeywordLayout];
  layout?: (typeof SkillLayout)[keyof typeof SkillLayout];
}

export interface EducationItem extends SectionItem {
  school: string;
  degree: string;
  area: string;
  grade: string;
  location: string;
  period: string;
  website: Website;
  /** HTML. */
  description: string;
}

export interface ProjectItem extends SectionItem {
  name: string;
  period: string;
  website: Website;
  /** HTML. */
  description: string;
}

export interface CertificationItem extends SectionItem {
  title: string;
  issuer: string;
  date: string;
  website: Website;
  /** HTML. */
  description: string;
}

export interface LanguageItem extends SectionItem {
  language: string;
  fluency: string;
  /** 0–5; 0 hides the level indicator. */
  level: number;
}

export interface InterestItem extends SectionItem {
  icon: string;
  iconColor: string;
  name: string;
  keywords: string[];
}

export interface ReferenceItem extends SectionItem {
  /** A person's name, or a note such as "Available upon request". */
  name: string;
  position: string;
  website: Website;
  phone: string;
  /** HTML. */
  description: string;
}

export interface LayoutPage {
  /** True when the main column spans the page and the sidebar is empty. */
  fullWidth: boolean;
  /** Section ids, in display order. */
  main: string[];
  /** Section ids, in display order. */
  sidebar: string[];
}

export interface Layout {
  /** Percentage of the page width, 10–50. */
  sidebarWidth: number;
  pages: LayoutPage[];
}

/** Template and design settings; untyped fields are carried through. */
export interface Metadata {
  layout: Layout;
  [setting: string]: unknown;
}

/**
 * The sections Resume.md feeds. The API requires every other section too;
 * they are carried through untyped so an update never drops them.
 */
export interface ResumeSections {
  experience: Section<ExperienceItem>;
  skills: SkillsSection;
  education: Section<EducationItem>;
  projects: Section<ProjectItem>;
  certifications: Section<CertificationItem>;
  languages: Section<LanguageItem>;
  interests: Section<InterestItem>;
  references: Section<ReferenceItem>;
  [section: string]: unknown;
}

/** The `data` object of a resume; untyped blocks are carried through. */
export interface ResumeData {
  basics: Basics;
  summary: Summary;
  sections: ResumeSections;
  metadata: Metadata;
  [block: string]: unknown;
}

// ─── Requests and responses ───────────────────────────────────────────────────

/** Body of `POST /resumes`. */
export interface CreateResumeBody {
  name: string;
  slug: string;
  tags: string[];
  withSampleData?: boolean;
}

/** Body of `PUT /resumes/{id}`. Every field is optional. */
export interface UpdateResumeBody {
  name?: string;
  slug?: string;
  tags?: string[];
  isPublic?: boolean;
  showDownloadButtons?: boolean;
  /** Validated in full: every required block, section and item field. */
  data?: ResumeData;
}

/** Response of `GET /resumes/{id}` and `PUT /resumes/{id}`. */
export interface Resume {
  id: string;
  name: string;
  slug: string;
  tags: string[];
  isPublic: boolean;
  showDownloadButtons: boolean;
  isLocked: boolean;
  hasPassword: boolean;
  updatedAt: string;
  data: ResumeData;
}

// ─── Parsed subset ────────────────────────────────────────────────────────────
//
// The keys Resume.md can fill today. Each type is a `Pick` of the API shape,
// so a renamed or retyped API field breaks the build instead of the request.

/** A header link: an icon, its text and the URL it points to. */
export type ParsedCustomField = Pick<
  BasicsCustomField,
  "icon" | "text" | "link"
>;

export type ParsedBasicsData = Omit<Basics, "customFields"> & {
  customFields: ParsedCustomField[];
};

/** `website` is set only when the job has a company URL. */
export type ParsedExperienceItem = Pick<
  ExperienceItem,
  "company" | "position" | "location" | "period" | "description"
> &
  Partial<Pick<ExperienceItem, "website">>;

export type ParsedSkillItem = Pick<SkillItem, "name" | "keywords">;

export type ParsedEducationItem = Pick<
  EducationItem,
  "school" | "degree" | "location" | "period" | "description"
>;

/** `website` is set only when the project has a link. */
export type ParsedProjectItem = Pick<ProjectItem, "name" | "description"> &
  Partial<Pick<ProjectItem, "website">>;

export type ParsedCertificationItem = Pick<
  CertificationItem,
  "title" | "issuer" | "description"
>;

export type ParsedLanguageItem = Pick<LanguageItem, "language" | "fluency">;

export type ParsedInterestItem = Pick<InterestItem, "name">;

export type ParsedReferenceItem = Pick<ReferenceItem, "name">;

/** Only the `items` of a section; its layout stays with the resume. */
type ParsedSection<TItem> = Pick<Section<TItem>, "items">;

export interface ParsedResumeData {
  basics: ParsedBasicsData;
  summary: Pick<Summary, "content">;
  sections: {
    experience: ParsedSection<ParsedExperienceItem>;
    skills: ParsedSection<ParsedSkillItem>;
    education: ParsedSection<ParsedEducationItem>;
    projects: ParsedSection<ParsedProjectItem>;
    certifications: ParsedSection<ParsedCertificationItem>;
    languages: ParsedSection<ParsedLanguageItem>;
    interests: ParsedSection<ParsedInterestItem>;
    references: ParsedSection<ParsedReferenceItem>;
  };
}
