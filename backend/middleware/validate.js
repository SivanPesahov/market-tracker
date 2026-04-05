/**
 * Schema-based input validation & sanitization middleware (OWASP A03: Injection).
 *
 * Usage:
 *   const validate = require('../middleware/validate');
 *   router.post('/trades', validate(tradeCreateSchema), handler);
 *
 * Schema field options:
 *   type       - 'string' | 'number' | 'boolean' | 'array'  (required)
 *   required   - boolean (default: false)
 *   minLength  - string: minimum character count
 *   maxLength  - string: maximum character count
 *   min        - number: minimum value (inclusive)
 *   max        - number: maximum value (inclusive)
 *   enum       - string: array of allowed values
 *   objectId   - string: validate 24-char hex MongoDB ObjectId
 *   maxItems   - array: maximum element count
 *   items      - array: { enum } validates each element against an allow-list
 *
 * validate() options (second argument):
 *   strict  - boolean (default: true)  reject any field NOT listed in the schema
 *             Set to false for multipart/form-data routes (multer may add metadata)
 *   source  - 'body' | 'query' (default: 'body')
 */

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const validate = (schema, { strict = true, source = 'body' } = {}) =>
  (req, res, next) => {
    const data   = req[source] || {};
    const errors = [];
    const allowed = new Set(Object.keys(schema));

    // ── Reject unexpected fields ──────────────────────────────────────────────
    // Prevents mass-assignment attacks and parameter pollution (OWASP A03).
    if (strict) {
      const extra = Object.keys(data).filter(k => !allowed.has(k));
      if (extra.length > 0) {
        return res.status(400).json({
          message: `Unexpected field(s): ${extra.join(', ')}`
        });
      }
    }

    // ── Per-field validation ──────────────────────────────────────────────────
    for (const [field, rules] of Object.entries(schema)) {
      const raw    = data[field];
      const absent = raw === undefined || raw === null || raw === '';

      // Required check
      if (rules.required && absent) {
        errors.push(`'${field}' is required`);
        continue;
      }
      if (absent) continue; // optional and not supplied — skip remaining checks

      switch (rules.type) {
        // ── String ─────────────────────────────────────────────────────────────
        case 'string': {
          if (typeof raw !== 'string') {
            errors.push(`'${field}' must be a string`);
            break;
          }
          const val = raw.trim();

          if (rules.minLength != null && val.length < rules.minLength) {
            errors.push(`'${field}' must be at least ${rules.minLength} characters`);
          }
          if (rules.maxLength != null && val.length > rules.maxLength) {
            errors.push(`'${field}' must be under ${rules.maxLength} characters`);
          }
          if (rules.enum && !rules.enum.includes(val)) {
            errors.push(`'${field}' must be one of: ${rules.enum.join(', ')}`);
          }
          if (rules.objectId && !OBJECT_ID_RE.test(val)) {
            errors.push(`'${field}' must be a valid ID`);
          }
          break;
        }

        // ── Number ─────────────────────────────────────────────────────────────
        // Coerces string representations to support multipart/form-data bodies.
        case 'number': {
          const num = typeof raw === 'string' ? parseFloat(raw) : raw;
          if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) {
            errors.push(`'${field}' must be a finite number`);
            break;
          }
          if (rules.min != null && num < rules.min) {
            errors.push(`'${field}' must be >= ${rules.min}`);
          }
          if (rules.max != null && num > rules.max) {
            errors.push(`'${field}' must be <= ${rules.max}`);
          }
          break;
        }

        // ── Boolean ────────────────────────────────────────────────────────────
        case 'boolean': {
          if (raw !== true && raw !== false && raw !== 'true' && raw !== 'false') {
            errors.push(`'${field}' must be a boolean`);
          }
          break;
        }

        // ── Array ──────────────────────────────────────────────────────────────
        // Accepts JSON-stringified arrays so FormData endpoints work seamlessly.
        case 'array': {
          let arr = raw;
          if (typeof raw === 'string') {
            try { arr = JSON.parse(raw); }
            catch { arr = raw.split(',').map(s => s.trim()).filter(Boolean); }
          }
          if (!Array.isArray(arr)) {
            errors.push(`'${field}' must be an array`);
            break;
          }
          if (rules.maxItems != null && arr.length > rules.maxItems) {
            errors.push(`'${field}' must have at most ${rules.maxItems} items`);
          }
          if (rules.items?.enum) {
            const bad = arr.filter(v => !rules.items.enum.includes(v));
            if (bad.length > 0) {
              errors.push(`'${field}' contains invalid value(s): ${bad.join(', ')}`);
            }
          }
          break;
        }

        default:
          break;
      }
    }

    if (errors.length > 0) {
      // Return the first error message to the client; expose full list for debugging.
      // Never include stack traces or internal details.
      return res.status(400).json({ message: errors[0], errors });
    }

    next();
  };

// ── Reusable enum constants ───────────────────────────────────────────────────

validate.MARKETS   = ['NAS100', 'US500', 'EURUSD', 'GBPUSD', 'XAUUSD'];
validate.OUTCOMES  = ['Win', 'Loss', 'Breakeven'];
validate.SESSIONS  = ['London', 'NY AM', 'NY PM', 'Asian', 'Off-Session'];
validate.DIRECTIONS= ['Long', 'Short'];
validate.CONCEPTS  = ['MSS', 'BOS', 'FVG', 'IFVG', 'Order Block', 'Liquidity Sweep', 'CISD', 'SMT'];
validate.BIAS_DIRS = ['Bullish', 'Bearish', 'Neutral'];

module.exports = validate;
