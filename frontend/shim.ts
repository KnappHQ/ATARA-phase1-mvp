import * as Crypto from "expo-crypto";
import "@ethersproject/shims";

if (typeof global.crypto !== "object") {
  global.crypto = {} as any;
}

if (typeof global.crypto.getRandomValues !== "function") {
  global.crypto.getRandomValues = (array: any) => {
    return Crypto.getRandomValues(array);
  };
}
