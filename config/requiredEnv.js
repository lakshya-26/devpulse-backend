/**
 * @param {string} name
 * @param {string} [hint]
 * @returns {string}
 */
function required(name, hint) {
  const v = process.env[name];
  if (v === undefined) {
    throw new Error(
      `Missing required environment variable: ${name}${hint ? `. ${hint}` : ''}`
    );
  }
  const trimmed = String(v).trim();
  if (trimmed === '') {
    throw new Error(
      `Environment variable ${name} is set but empty.${hint ? ` ${hint}` : ''}`
    );
  }
  return trimmed;
}

module.exports = { required };
