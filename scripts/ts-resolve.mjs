import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context); }
  catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND' && /^\\.\\.?\\//.test(specifier)) return next(specifier + '.ts', context);
    throw e;
  }
}`), import.meta.url);
