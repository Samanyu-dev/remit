import type { MetadataRoute } from "next";

// Installable: "Add to Home Screen" opens Remit full-screen with its own icon, no browser UI.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Remit",
    short_name: "Remit",
    description: "Send dollars anywhere, as a link.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050814",
    theme_color: "#050814",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
