import { createFileRoute, redirect } from "@tanstack/react-router";

/** Connecting an agent is part of the Bot page now: its Agents tab. Old links land there. */
export const Route = createFileRoute("/agents")({
  beforeLoad: () => {
    throw redirect({ to: "/bot", search: { tab: "agents" }, statusCode: 301 });
  },
});
