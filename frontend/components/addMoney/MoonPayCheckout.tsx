import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { X } from "lucide-react-native";
import { COLORS } from "@/utils/constants";
import {
  CHECKOUT_LOAD_TIMEOUT_MS,
  classifyWebViewError,
  decideNavigation,
  readRedirectUrl,
  type OnrampFailure,
} from "@/utils/onrampFlow";

export type CheckoutExit = "closed" | "returned" | "retry";

/**
 * The MoonPay checkout inside the app, on the signed URL exactly as the server
 * returned it (already checked by `validateCheckoutUrl`).
 *
 * Apple Pay: WKWebView only allows it when no script is injected into the page.
 * react-native-webview injects an HTML5 history shim by default, so this view sets
 * `enableApplePay` and never uses injectedJavaScript, onMessage or injectJavaScript.
 *
 * IP matching: unlike Safari views, WKWebView is not routed through iCloud Private
 * Relay, so MoonPay sees the same public IP the backend hashed into allowedIpAddress.
 */
export function MoonPayCheckout({ url, onExit }: { url: string | null; onExit: (exit: CheckoutExit) => void }) {
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<OnrampFailure | null>(null);
  const exited = useRef(false);
  const redirectUrl = url ? readRedirectUrl(url) : null;

  useEffect(() => {
    exited.current = false;
    setLoading(true);
    setFailure(null);
  }, [url]);

  // The first page must show up in time, or the person gets Retry / Close.
  useEffect(() => {
    if (!url || !loading || failure) return;
    const timer = setTimeout(() => setFailure(classifyWebViewError({ kind: "timeout" })), CHECKOUT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [url, loading, failure]);

  // Once only, whichever comes first: Close, the redirect, Retry, or the system back gesture.
  const exit = (how: CheckoutExit) => {
    if (exited.current) return;
    exited.current = true;
    onExit(how);
  };

  const onShouldStartLoadWithRequest = (request: ShouldStartLoadRequest) => {
    const decision = decideNavigation(request.url, redirectUrl);
    if (decision === "load") return true;
    if (decision === "return") exit("returned");
    else if (decision === "external") Linking.openURL(request.url).catch(() => undefined);
    return false;
  };

  return (
    <Modal visible={url !== null} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => exit("closed")}>
      <SafeAreaView className="flex-1 bg-black" edges={["top", "bottom"]}>
        <View className="flex-row items-center justify-between px-4 py-2">
          <Text className="text-white font-semibold">MoonPay (sandbox)</Text>
          <Pressable
            onPress={() => exit("closed")}
            accessibilityRole="button"
            accessibilityLabel="Close MoonPay"
            hitSlop={8}
            className="w-11 h-11 items-center justify-center rounded-full bg-white/10"
          >
            <X size={20} color={COLORS.white} />
          </Pressable>
        </View>
        {url && !failure ? (
          <WebView
            source={{ uri: url }}
            enableApplePay
            // Every navigation goes through decideNavigation; the default whitelist would hand
            // about:blank payment frames to Linking.
            originWhitelist={["*"]}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            setSupportMultipleWindows={false}
            javaScriptCanOpenWindowsAutomatically={false}
            sharedCookiesEnabled={false}
            allowsBackForwardNavigationGestures={false}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="prompt"
            onLoadEnd={() => setLoading(false)}
            onError={({ nativeEvent }) => setFailure(classifyWebViewError({ kind: "load", code: nativeEvent.code }))}
            onHttpError={({ nativeEvent }) => setFailure(classifyWebViewError({ kind: "http", statusCode: nativeEvent.statusCode }))}
            style={{ flex: 1, backgroundColor: COLORS.black }}
          />
        ) : null}
        {url && loading && !failure ? (
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <ActivityIndicator color={COLORS.white} />
          </View>
        ) : null}
        {failure ? (
          <View accessibilityRole="alert" className="flex-1 justify-center px-6">
            <Text className="text-white text-lg font-semibold">MoonPay did not load</Text>
            <Text className="text-white/65 text-sm leading-5 mt-2">{failure.message}</Text>
            {failure.code ? <Text selectable className="mt-1 text-xs text-white/40">{`Reference: ${failure.code}`}</Text> : null}
            <View className="flex-row gap-3 mt-6">
              <Pressable onPress={() => exit("closed")} accessibilityRole="button" className="flex-1 h-12 rounded-2xl bg-white/10 items-center justify-center">
                <Text className="text-white">Close</Text>
              </Pressable>
              <Pressable onPress={() => exit("retry")} accessibilityRole="button" className="flex-1 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: COLORS.white }}>
                <Text style={{ color: COLORS.black }} className="font-semibold">Try again</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
