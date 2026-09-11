import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/site/landing";

export const Route = createFileRoute("/")({ component: Landing });
