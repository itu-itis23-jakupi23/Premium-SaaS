/* Migration note: moved workspace DOM listener helpers and duplicate-listener guards from admin_workspace_bootstrap.js so persistent shell controls can be rebound safely. */

const EVENT_BINDINGS = new WeakMap();

function getBindingRegistry(target) {
  let registry = EVENT_BINDINGS.get(target);
  if (!registry) {
    registry = new Set();
    EVENT_BINDINGS.set(target, registry);
  }
  return registry;
}

function getOptionsSignature(options) {
  if (typeof options === 'boolean') {
    return `capture:${options}`;
  }
  if (!options) {
    return 'capture:false:once:false:passive:false';
  }
  return [
    `capture:${Boolean(options.capture)}`,
    `once:${Boolean(options.once)}`,
    `passive:${Boolean(options.passive)}`,
  ].join(':');
}

export function bindEvent(target, type, handler, options) {
  if (!target || typeof target.addEventListener !== 'function' || typeof handler !== 'function') {
    return false;
  }
  target.addEventListener(type, handler, options);
  return true;
}

export function bindOnce(target, type, key, handler, options) {
  if (!target || typeof target.addEventListener !== 'function' || typeof handler !== 'function') {
    return false;
  }
  const signature = [type, key, getOptionsSignature(options)].join('::');
  const registry = getBindingRegistry(target);
  if (registry.has(signature)) {
    return false;
  }
  target.addEventListener(type, handler, options);
  registry.add(signature);
  return true;
}
