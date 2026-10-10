import { createFileRoute, redirect } from "@tanstack/react-router";

/** Aperture Agent Check is part of the Bot page now: its Check tab. Old links land there. */
export const Route = createFileRoute("/agent-check")({
  beforeLoad: () => {
    throw redirect({ to: "/bot", search: { tab: "check" }, statusCode: 301 });
  },
});
