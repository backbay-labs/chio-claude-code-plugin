// Signed deterministic fixture with a fixed test seed. This is not a resource owner or a qualified kernel.
import { signerFor, signedDecision as decide, signedOutcome as outcome } from "../dist/demo/fixture.js";
export const seed = "a1".repeat(32);
export const signer = signerFor(seed);
export const signedDecision = (config, proposal, decision = "approved") => decide(config, proposal, decision, seed);
export const signedOutcome = (config, request) => outcome(config, request, seed);
