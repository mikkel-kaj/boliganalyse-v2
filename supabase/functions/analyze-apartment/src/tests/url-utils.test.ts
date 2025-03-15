import { assertEquals } from "std/testing/asserts";
import { normalizeUrl, extractDomain, isAbsoluteUrl, resolveUrl } from "../utils/url.ts";

// URL normalization tests
Deno.test("normalizeUrl removes query parameters", () => {
  const url = "https://boligsiden.dk/adresse/example?param=value";
  const expected = "https://boligsiden.dk/adresse/example";
  assertEquals(normalizeUrl(url), expected);
});

Deno.test("normalizeUrl removes hash fragments", () => {
  const url = "https://boligsiden.dk/adresse/example#section";
  const expected = "https://boligsiden.dk/adresse/example";
  assertEquals(normalizeUrl(url), expected);
});

Deno.test("normalizeUrl handles invalid URLs", () => {
  const url = "not-a-valid-url";
  assertEquals(normalizeUrl(url), url); // Should return original on error
});

// Domain extraction tests
Deno.test("extractDomain gets domain without www", () => {
  const url = "https://www.boligsiden.dk/adresse/example";
  const expected = "boligsiden.dk";
  assertEquals(extractDomain(url), expected);
});

Deno.test("extractDomain handles subdomains", () => {
  const url = "https://sub.boligsiden.dk/adresse/example";
  const expected = "sub.boligsiden.dk";
  assertEquals(extractDomain(url), expected);
});

Deno.test("extractDomain handles invalid URLs", () => {
  const url = "not-a-valid-url";
  assertEquals(extractDomain(url), "");
});

// Absolute URL tests
Deno.test("isAbsoluteUrl identifies absolute URLs", () => {
  const url = "https://boligsiden.dk/adresse/example";
  assertEquals(isAbsoluteUrl(url), true);
});

Deno.test("isAbsoluteUrl identifies relative URLs", () => {
  const url = "/adresse/example";
  assertEquals(isAbsoluteUrl(url), false);
});

// URL resolution tests
Deno.test("resolveUrl resolves relative URLs", () => {
  const baseUrl = "https://boligsiden.dk";
  const relativeUrl = "/adresse/example";
  const expected = "https://boligsiden.dk/adresse/example";
  assertEquals(resolveUrl(baseUrl, relativeUrl), expected);
});

Deno.test("resolveUrl handles absolute URLs", () => {
  const baseUrl = "https://boligsiden.dk";
  const absoluteUrl = "https://home.dk/ejerbolig/example";
  assertEquals(resolveUrl(baseUrl, absoluteUrl), absoluteUrl);
}); 