import { describe, expect, it } from "vitest";

import { decodeRenaissOsCardToken, encodeRenaissOsCardToken, parseRenaissOsCardHref } from "./data";

const cardHref = "/card/pokemon/base-set/4-charizard-psa-10";

describe("Renaiss OS card tokens", () => {
  it("parses official card hrefs", () => {
    expect(parseRenaissOsCardHref(cardHref)).toMatchObject({
      game: "pokemon",
      set: "base-set",
      card: "4-charizard-psa-10",
      href: cardHref
    });

    expect(parseRenaissOsCardHref(encodeRenaissOsCardToken(cardHref))).toBeNull();
    expect(parseRenaissOsCardHref(`${cardHref}?window=30`)).toBeNull();
  });

  it("decodes canonical Atlas route tokens", () => {
    expect(decodeRenaissOsCardToken(encodeRenaissOsCardToken(cardHref))).toMatchObject({
      href: cardHref
    });
    expect(decodeRenaissOsCardToken(cardHref)).toBeNull();
  });

  it("rejects malformed, padded, non-card, and invalid UTF-8 tokens", () => {
    const canonical = encodeRenaissOsCardToken(cardHref);
    const invalidUtf8 = Buffer.from([0xff, 0xfe]).toString("base64url");

    expect(decodeRenaissOsCardToken("%%%")).toBeNull();
    expect(decodeRenaissOsCardToken(`${canonical}=`)).toBeNull();
    expect(
      decodeRenaissOsCardToken(Buffer.from("/market/pokemon").toString("base64url"))
    ).toBeNull();
    expect(decodeRenaissOsCardToken(invalidUtf8)).toBeNull();
  });
});
