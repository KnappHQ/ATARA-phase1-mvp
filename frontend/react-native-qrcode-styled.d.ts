// The package ships declarations under lib/typescript but its package.json
// does not point to them, so TypeScript cannot find them on its own.
declare module "react-native-qrcode-styled" {
  export { default } from "react-native-qrcode-styled/lib/typescript/commonjs/src/index";
}
