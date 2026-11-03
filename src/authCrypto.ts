import { AppError } from "./i18n";
import * as NativeCrypto from "expo-crypto";
// Hermes does not provide WebCrypto on every supported OS. Supply native entropy
// and SHA-256 so Supabase always generates S256 challenges rather than plain PKCE.
const cryptoObject = globalThis.crypto || {};
if (!globalThis.crypto)
  Object.defineProperty(globalThis, "crypto", {
    value: cryptoObject,
    configurable: true,
  });
if (!cryptoObject.getRandomValues)
  Object.defineProperty(cryptoObject, "getRandomValues", {
    value: NativeCrypto.getRandomValues,
  });
if (!cryptoObject.subtle)
  Object.defineProperty(cryptoObject, "subtle", {
    value: {
      digest: async (
        algorithm: string | { name: string },
        source: ArrayBuffer | ArrayBufferView,
      ) => {
        if (
          (typeof algorithm === "string"
            ? algorithm
            : algorithm.name
          ).toUpperCase() !== "SHA-256"
        )
          throw new AppError("errors.crypto");
        const bytes = ArrayBuffer.isView(source)
          ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
          : new Uint8Array(source);
        return NativeCrypto.digest(
          NativeCrypto.CryptoDigestAlgorithm.SHA256,
          new Uint8Array(bytes),
        );
      },
    },
  });
