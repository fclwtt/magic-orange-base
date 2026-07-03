// Device Pair API module exposes the plugin public contract.
export {
  approveDevicePairing,
  clearDeviceBootstrapTokens,
  issueDeviceBootstrapToken,
  PAIRING_SETUP_BOOTSTRAP_PROFILE,
  listDevicePairing,
  revokeDeviceBootstrapToken,
  type DeviceBootstrapProfile,
} from "mo/plugin-sdk/device-bootstrap";
export { definePluginEntry, type OpenClawPluginApi } from "mo/plugin-sdk/plugin-entry";
export {
  resolveGatewayBindUrl,
  resolveGatewayPort,
  resolveTailnetHostWithRunner,
} from "mo/plugin-sdk/core";
export { resolveAdvertisedLanHost } from "mo/plugin-sdk/gateway-runtime";
export {
  resolvePreferredOpenClawTmpDir,
  runPluginCommandWithTimeout,
} from "mo/plugin-sdk/sandbox";
export { renderQrPngBase64, renderQrPngDataUrl, writeQrPngTempFile } from "./qr-image.js";
