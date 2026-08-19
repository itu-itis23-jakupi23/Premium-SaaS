// Minimal ambient types for the `qrcode` package — only the surface this app uses.
declare module "qrcode" {
  interface QRCodeToDataURLOptions {
    margin?: number;
    width?: number;
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  }
  export function toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;
  const QRCode: { toDataURL: typeof toDataURL };
  export default QRCode;
}
