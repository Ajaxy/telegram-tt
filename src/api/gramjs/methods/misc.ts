import { Api as GramJs } from '../../../lib/gramjs';

import type { ApiAppConfig, ApiConfig, ApiPromoData } from '../../types';

import { buildAppConfig } from '../apiBuilders/appConfig';
import { buildApiConfig, buildApiPromoData } from '../apiBuilders/misc';
import { DEFAULT_PRIMITIVES } from '../gramjsBuilders';
import { invokeRequest } from './client';

export async function fetchAppConfig({ hash }: { hash?: number }): Promise<ApiAppConfig | undefined> {
  const result = await invokeRequest(new GramJs.help.GetAppConfig({ hash: hash ?? DEFAULT_PRIMITIVES.INT }));
  if (!result || result instanceof GramJs.help.AppConfigNotModified) return undefined;

  const { config, hash: resultHash } = result;
  return buildAppConfig(config, resultHash);
}

export async function fetchConfig(): Promise<ApiConfig | undefined> {
  const result = await invokeRequest(new GramJs.help.GetConfig());
  if (!result) return undefined;

  return buildApiConfig(result);
}

export async function fetchPromoData(): Promise<ApiPromoData | undefined> {
  const result = await invokeRequest(new GramJs.help.GetPromoData());
  if (!result || result instanceof GramJs.help.PromoDataEmpty) return undefined;

  return buildApiPromoData(result);
}

export async function dismissSuggestion(suggestion: string): Promise<void> {
  await invokeRequest(new GramJs.help.DismissSuggestion({
    peer: new GramJs.InputPeerEmpty(),
    suggestion,
  }));
}
