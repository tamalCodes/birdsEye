// The product name is a placeholder. It appears in exactly one place: here.
// Changing NAME changes the config filename, the output directory, the plugin
// command namespace in the docs, and every user-facing string at once.
export const NAME = 'codemap';

export const CONFIG_FILE = `${NAME}.config.json`;
export const OUT_DIR = NAME;
export const CACHE_DIR = `${OUT_DIR}/.cache`;
export const IGNORE_FILE = `.${NAME}ignore`;

export const GRAPH_VERSION = 3;
