import { describe, it, expect } from "vitest";
import {
  ENV_FILE,
  EnvVar,
  resolveCareersConfig,
  careersConfigProblem,
} from "./config.ts";
import { BASE_URL, careersEnv } from "./mocks.ts";

describe("resolveCareersConfig", () => {
  it("reads the API base URL", () => {
    expect(resolveCareersConfig(careersEnv)).toEqual({ baseUrl: BASE_URL });
  });

  it("throws naming the missing variable and the .env file", () => {
    expect(() => resolveCareersConfig({})).toThrow(
      new RegExp(`${EnvVar.ApiUrl}.*\\${ENV_FILE}`),
    );
  });

  it("treats an empty value as missing", () => {
    expect(() => resolveCareersConfig({ [EnvVar.ApiUrl]: "" })).toThrow(
      EnvVar.ApiUrl,
    );
  });
});

describe("careersConfigProblem", () => {
  it("returns the missing variable as the reason", () => {
    expect(careersConfigProblem({})).toMatch(/^Missing CAREERS_API_URL/);
  });

  it("returns undefined when the variable is set", () => {
    expect(careersConfigProblem(careersEnv)).toBeUndefined();
  });
});
