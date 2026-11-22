// Web app manifest: the icon and name used when Bidlyze is added to a home screen.
export default function manifest() {
  return {
    name: "Bidlyze",
    short_name: "Bidlyze",
    description: "Check a supplier proposal against a tender's requirements, with the evidence quoted.",
    start_url: "/submission-check",
    display: "standalone",
    background_color: "#F5F7FA",
    theme_color: "#0E5A6B",
    icons: [
      { src: "/brand/bidlyze-mark-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/bidlyze-mark-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/bidlyze-mark-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
