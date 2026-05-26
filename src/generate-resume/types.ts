export interface ContactItem {
  label: string;
  href?: string | null;
  target?: string | null;
  icon: string;
}

export interface SkillGroup {
  id: string;
  heading: string;
  items: string[];
}

export interface ExperienceItem {
  company: string;
  location: string;
  role: string;
  dates: string;
  datetime: string;
  context?: string | null;
  bullets: string[];
  stack: string;
}

export interface EducationBullet {
  text: string;
  linkText?: string | null;
  href?: string | null;
}

export interface EducationItem {
  school: string;
  location?: string | null;
  degree: string;
  dates: string;
  datetime: string;
  context?: string | null;
  bullets: EducationBullet[];
}

export interface ProjectLink {
  label: string;
  href: string;
}

export interface ProjectItem {
  title: string;
  context: string;
  links: ProjectLink[];
  stack: string;
}

export interface Credential {
  id: string;
  href: string;
}

export interface CertificationItem {
  title: string;
  issuer: string;
  credentials: Credential[];
}

export interface CvData {
  header: {
    name: string;
    title: string;
  };
  contact: {
    items: ContactItem[];
  };
  skillGroups: SkillGroup[];
  summary: {
    heading: string;
  };
  experience: {
    items: ExperienceItem[];
  };
  education: {
    items: EducationItem[];
  };
  projects: {
    items: ProjectItem[];
  };
  certifications: {
    items: CertificationItem[];
  };
  footer: {
    languages: { items: string[] };
    interests: { text: string };
    references: string;
  };
}
