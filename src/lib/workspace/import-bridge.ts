type Handlers = {
  pickFolder: () => void;
  pickZip: () => void;
};

let handlers: Handlers | null = null;

export function registerImportHandlers(next: Handlers) {
  handlers = next;
  return () => {
    if (handlers === next) handlers = null;
  };
}

export function pickFolder() {
  handlers?.pickFolder();
}

export function pickZip() {
  handlers?.pickZip();
}
