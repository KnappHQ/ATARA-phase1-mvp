# Interface alignment

The mobile repository is an Expo/React Native implementation. The Lovable
render is a separate web reference, so copying a screenshot into a native
screen does not automatically preserve the same layout, fonts, spacing or
navigation behavior.

The new flows use the existing ATARA tokens in `frontend/tailwind.config.js`
and `frontend/utils/constants.ts`: black background, platinum text, sapphire
accent, translucent white cards, rounded 2xl/3xl surfaces, compact mono labels
and the existing slide-up screen transition. They also reuse the current home
action hierarchy instead of adding a second visual language.

For a pixel-accurate Lovable port, the Lovable source or an exported design
token file must be kept alongside the mobile project. Without that source, the
current token set is the reliable visual contract for both platforms.
