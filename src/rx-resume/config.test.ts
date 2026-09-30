import { describe, it, expect } from "vitest";
import {
  ENV_FILE,
  EnvVar,
  resolveApiConfig,
  resolveBuilderUrl,
} from "./config.ts";

const env = {
  [EnvVar.ApiKey]: "key",
  [EnvVar.BaseUrl]: "https://rx.example/api/openapi",
  [EnvVar.AppUrl]: "https://rx.example",
};

describe("resolveApiConfig", () => {
  it("reads the API key, base URL and app URL", () => {
    expect(resolveApiConfig(env)).toEqual({
      apiKey: "key",
      baseUrl: "https://rx.example/api/openapi",
      appUrl: "https://rx.example",
    });
  });

  it.each([EnvVar.ApiKey, EnvVar.BaseUrl, EnvVar.AppUrl])(
    "throws naming %s when it is missing",
    (name) => {
      expect(() => resolveApiConfig({ ...env, [name]: undefined })).toThrow(
        name,
      );
    },
  );

  it("treats an empty value as missing", () => {
    expect(() => resolveApiConfig({ ...env, [EnvVar.ApiKey]: "" })).toThrow(
      EnvVar.ApiKey,
    );
  });

  it("lists every missing variable and points to the .env file", () => {
    expect(() => resolveApiConfig({})).toThrow(
      new RegExp(
        `${EnvVar.ApiKey}.*${EnvVar.BaseUrl}.*${EnvVar.AppUrl}.*\\${ENV_FILE}`,
        "s",
      ),
    );
  });
});

describe("resolveBuilderUrl", () => {
  it("links to the resume in the builder", () => {
    expect(resolveBuilderUrl("https://rx.example", "resume-1")).toBe(
      "https://rx.example/builder/resume-1",
    );
  });

  it("ignores a trailing slash on the app URL", () => {
    expect(resolveBuilderUrl("https://rx.example/", "resume-1")).toBe(
      "https://rx.example/builder/resume-1",
    );
  });

  it("URL-encodes the resume id", () => {
    expect(resolveBuilderUrl("https://rx.example", "a/b")).toBe(
      "https://rx.example/builder/a%2Fb",
    );
  });
});
