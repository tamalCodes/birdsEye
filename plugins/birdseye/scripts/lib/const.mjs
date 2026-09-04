// The product name lives in exactly one place: here. NAME is the slug - it
// becomes the config filename, the output directory, the ignore file and the
// plugin command namespace, so it stays lowercase and filesystem-safe. DISPLAY
// is the brand as written, and is the only form a user ever reads.
export const NAME = 'birdseye';
export const DISPLAY = 'birdsEye';

export const CONFIG_FILE = `${NAME}.config.json`;
export const OUT_DIR = NAME;
export const CACHE_DIR = `${OUT_DIR}/.cache`;
export const IGNORE_FILE = `.${NAME}ignore`;

export const GRAPH_VERSION = 5;
