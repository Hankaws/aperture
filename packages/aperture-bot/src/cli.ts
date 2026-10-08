#!/usr/bin/env node
/**
 *   APERTURE_MODEL_KEY=… aperture-bot run --task "Add a currency to formatPrice"
 */
import { main } from "./main.ts";

void main(process.argv.slice(2), process.env).then((code) => {
  process.exitCode = code;
});
