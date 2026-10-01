/**
 * Deterministic parts-query detector — zero API calls, O(n) regex.
 *
 * Returns true when the user message looks like a parts / identification /
 * replacement query rather than a pure operational diagnostic.
 *
 * Triggers on ANY of:
 *   1. A model number (alphanumeric, 4+ chars, must contain both a letter and a digit)
 *   2. A recognised manufacturer name  +  a component keyword
 *   3. An explicit replacement / part-number intent keyword
 *   4. A dead/failed component keyword  +  a component noun
 */

// Model numbers: e.g. ZF48K5E, AK-CC55, 5F20, ZB45KCE, 06DR337, Y-744
// Must be ≥4 chars, at least one letter, at least one digit
const MODEL_RE = /\b(?=[A-Z0-9-]{4,})(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*[0-9])[A-Z][A-Z0-9-]{3,}\b/i

const MANUFACTURER_RE =
  /\b(copeland|danfoss|emerson|sporlan|carlyle|bitzer|tecumseh|embraco|bristol|hussmann|tyler|heatcraft|hill\s+phoenix|honeywell|white[\s-]?rodgers|paragon|ranco|alco|castel|lennox|carrier|trane|york|rheem|ruud|goodman|daikin|scroll\s+tech|liebert|climate\s+master|friedrich)\b/i

// Component nouns that are clearly about a physical part
const COMPONENT_RE =
  /\b(motor|compressor|board|control\s*board|defrost\s*board|valve|txv|epr|solenoid|sensor|capacitor|contactor|relay|drier|filter\s*drier|actuator|thermostat|module|controller|overload|fan\s*blade|impeller|bearing|sight\s*glass|pressure\s*switch|unloader|crankcase\s*heater|heat\s*exchanger|coil)\b/i

// Explicit replacement / parts intent
const REPLACE_RE = /\b(replace(ment)?|part\s*(#|num(ber)?)?|cross[\s-]?ref(erence)?|interchange|substitute|equivalent|what.*part|which.*part|need.*part|find.*part|source.*part|order.*part)\b/i

// Failure adjectives — component-death context
const FAIL_RE = /\b(dead|failed|bad|burnt|burned|seized|shot|blown|fried|shorted|open|locked\s*out)\b/i

// Words/phrases that signal a spec, value, or how-to question — not a part to order
const SPEC_SIGNAL_RE =
  /\b(spec(?:s|ification)?|torque|charge|setting|setpoint|parameter|procedure|adjust(?:ment)?|calibrat(?:e|ion)?|how\s+do\s+i|how\s+to)\b/i

export function isPartsQuery(text: string): boolean {
  const t = text // keep original case for regex; all patterns use /i

  // Spec/procedure questions are not parts queries unless they also have ordering intent
  if (SPEC_SIGNAL_RE.test(t) && !REPLACE_RE.test(t)) return false

  // 1. Model number present — always a parts signal
  if (MODEL_RE.test(t)) return true

  // 2. Manufacturer name + component noun
  if (MANUFACTURER_RE.test(t) && COMPONENT_RE.test(t)) return true

  // 3. Explicit part/replacement intent
  if (REPLACE_RE.test(t)) return true

  // 4. Component noun in a dead/failed context
  if (COMPONENT_RE.test(t) && FAIL_RE.test(t)) return true

  return false
}
