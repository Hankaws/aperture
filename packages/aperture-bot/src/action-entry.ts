/**
 * The Action's entry point: dist/action.cjs, which action.yml runs.
 */
import { runAction } from "./action.ts";

void runAction(process.env).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.log(
      `::error title=Aperture Bot::${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 2;
  },
);
