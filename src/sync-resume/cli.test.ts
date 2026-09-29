import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { resolveSyncPaths } from "./cli.ts";

const CWD = "/work/portfolio";
const PACKAGE_ROOT = "/work/portfolio/packages/resume-tools";

describe("resolveSyncPaths", () => {
  it("uses package defaults for the RxResume paths", () => {
    const paths = resolveSyncPaths(
      ["--cv", "src/content/cv/en.md", "--resume", "resume/Resume.md"],
      { cwd: CWD, packageRoot: PACKAGE_ROOT },
    );

    expect(paths).toEqual({
      cv: resolve(CWD, "src/content/cv/en.md"),
      resume: resolve(CWD, "resume/Resume.md"),
      json: resolve(PACKAGE_ROOT, "resume/RxResume/Resume.json"),
      template: resolve(PACKAGE_ROOT, "resume/RxResume/Resume.template.json"),
    });
  });

  it("resolves every overridden path against cwd", () => {
    const paths = resolveSyncPaths(
      [
        "--cv",
        "cv.md",
        "--resume",
        "data/Resume.md",
        "--json",
        "out/Resume.json",
        "--template",
        "/abs/template.json",
      ],
      { cwd: CWD, packageRoot: PACKAGE_ROOT },
    );

    expect(paths).toEqual({
      cv: resolve(CWD, "cv.md"),
      resume: resolve(CWD, "data/Resume.md"),
      json: resolve(CWD, "out/Resume.json"),
      template: "/abs/template.json",
    });
  });

  it("throws a usage error when --cv is missing", () => {
    expect(() =>
      resolveSyncPaths(["--resume", "Resume.md"], {
        cwd: CWD,
        packageRoot: PACKAGE_ROOT,
      }),
    ).toThrow(/--cv <path> is required/);
  });

  it("throws a usage error when --resume is missing", () => {
    expect(() =>
      resolveSyncPaths(["--cv", "cv.md"], {
        cwd: CWD,
        packageRoot: PACKAGE_ROOT,
      }),
    ).toThrow(/--resume <path> is required/);
  });

  it("throws on unknown options", () => {
    expect(() =>
      resolveSyncPaths(["--cv", "cv.md", "--resume", "r.md", "--nope", "x"], {
        cwd: CWD,
        packageRoot: PACKAGE_ROOT,
      }),
    ).toThrow();
  });
});
