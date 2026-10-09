import type { MetadataRoute } from "next";
import { env } from "@/lib/server-env";

/** Showcase and public events are indexed; personal and management pages are not. */
const PRIVATE_PATHS = [
  "/home",
  "/profile",
  "/tickets",
  "/points",
  "/grades",
  "/tasks",
  "/team",
  "/meetings",
  "/inventory",
  "/join",
  "/manage",
  "/preview",
  "/login",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/api/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: new URL("/sitemap.xml", env.SITE_URL).toString(),
  };
}
