// Lets Node tests import app code that uses the Next.js "@/..." path alias.
// Used by: npm test  (node --import ./tests/helpers/register-alias.mjs --test ...)
import { register } from "node:module";
register("./alias-hooks.mjs", import.meta.url);
