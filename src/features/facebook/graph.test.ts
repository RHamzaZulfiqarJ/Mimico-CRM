import { afterEach, describe, expect, it, vi } from "vitest";

import {
  facebookGraphApiVersion,
  fetchFacebookPageIdentity,
} from "@/features/facebook/graph";

describe("Facebook Graph client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.FACEBOOK_GRAPH_API_VERSION;
  });

  it("sends the Page token only in the authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "page-1", name: "Mimico" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchFacebookPageIdentity("private-token")).resolves.toEqual({
      id: "page-1",
      name: "Mimico",
    });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain("private-token");
    expect(options.headers).toEqual({ Authorization: "Bearer private-token" });
  });

  it("accepts only a version-shaped Graph API override", () => {
    process.env.FACEBOOK_GRAPH_API_VERSION = "latest";
    expect(facebookGraphApiVersion()).toBe("v23.0");
    process.env.FACEBOOK_GRAPH_API_VERSION = "v24.0";
    expect(facebookGraphApiVersion()).toBe("v24.0");
  });
});
